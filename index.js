const { BskyAgent, RichText } = require('@atproto/api')
const express = require('express')
const dotenv = require('dotenv')

// Load environment variables from .env file if present
dotenv.config()

const app = express()
const port = process.env.PORT || 3000
const host = '0.0.0.0'

// Print all environment variables (excluding sensitive data)
console.log('Starting server with configuration:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: port,
  HOST: host,
  BLUESKY_USERNAME: process.env.BLUESKY_USERNAME ? '(set)' : '(not set)',
  BLUESKY_PASSWORD: process.env.BLUESKY_PASSWORD ? '(set)' : '(not set)',
})

// Validate required environment variables
if (!process.env.BLUESKY_USERNAME || !process.env.BLUESKY_PASSWORD) {
  console.error('ERROR: Missing required environment variables:',
    !process.env.BLUESKY_USERNAME ? 'BLUESKY_USERNAME' : '',
    !process.env.BLUESKY_PASSWORD ? 'BLUESKY_PASSWORD' : ''
  )
  process.exit(1)
}

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

// Initialize Bluesky agent
const agent = new BskyAgent({
  service: 'https://bsky.social'
})

// Define health-related keywords and topics
const healthTopics = [
  // General Health Terms
  'mens health',
  'gay health',
  'lgbtq health',
  'queer health',
  'healthcare',
  'wellness',
  
  // Sexual Health
  'sexual health',
  'sti prevention',
  'std prevention',
  'prep',
  'hiv prevention',
  'hiv',
  'aids',
  'sexual wellness',
  'safe sex',
  'mpox',
  'monkeypox',
  
  // Mental Health
  'mental health',
  'therapy',
  'counseling',
  'depression',
  'anxiety',
  'mental wellness',
  'self care',
  'support group',
  
  // Physical Health
  'fitness',
  'nutrition',
  'exercise',
  'workout',
  'gym',
  'physical health',
  
  // Preventive Care
  'preventive care',
  'screening',
  'checkup',
  'vaccination',
  'prevention',
  
  // Healthcare Access
  'healthcare access',
  'health insurance',
  'clinic',
  'doctor',
  'physician',
  'medical'
]

async function getFeedPosts(cursor) {
  try {
    console.log('Attempting to login to Bluesky with username:', process.env.BLUESKY_USERNAME)
    await agent.login({
      identifier: process.env.BLUESKY_USERNAME,
      password: process.env.BLUESKY_PASSWORD
    })
    console.log('Successfully logged in to Bluesky')

    const limit = 100
    console.log('Fetching timeline with cursor:', cursor)
    
    // Define relevant health-focused accounts
    const healthAccounts = [
      'cdc.bsky.social',
      'who.bsky.social',
      'health.bsky.social',
      'healthcare.bsky.social',
      'wellness.bsky.social',
      'lgbtq.bsky.social',
      'pride.bsky.social',
      'gaymens.bsky.social'
    ]
    
    let allPosts = []
    
    // Get posts from the general timeline
    const timelineResponse = await agent.getTimeline({ limit, cursor })
    allPosts = [...timelineResponse.data.feed]
    
    // Get posts from health-focused accounts
    for (const account of healthAccounts) {
      try {
        const response = await agent.getAuthorFeed({ actor: account, limit: 30 })
        if (response.data.feed) {
          allPosts = [...allPosts, ...response.data.feed]
        }
      } catch (error) {
        console.log(`Could not fetch feed for ${account}:`, error.message)
      }
    }
    
    // Search for health-related hashtags
    const healthHashtags = ['health', 'wellness', 'lgbtqhealth', 'gayhealth', 'menshealth', 'prep', 'hivprevention']
    for (const hashtag of healthHashtags) {
      try {
        const response = await agent.searchPosts({ q: '#' + hashtag, limit: 20 })
        if (response.data.posts) {
          allPosts = [...allPosts, ...response.data.posts.map(post => ({ post }))]
        }
      } catch (error) {
        console.log(`Could not search for hashtag ${hashtag}:`, error.message)
      }
    }
    
    console.log(`Retrieved ${allPosts.length} total posts`)
    
    // Filter posts containing health-related content
    const filteredFeed = allPosts
      .filter(item => {
        if (!item.post?.record?.text) return false
        const postText = item.post.record.text.toLowerCase()
        
        // Check for health topics
        const hasHealthTopic = healthTopics.some(topic => postText.includes(topic.toLowerCase()))
        
        // Check for LGBTQ+ context
        const hasLGBTQContext = postText.includes('gay') || 
                               postText.includes('lgbtq') || 
                               postText.includes('queer') || 
                               postText.includes('pride') ||
                               postText.includes('lgbt')
        
        // Post must have both health content and LGBTQ+ context
        return hasHealthTopic && hasLGBTQContext
      })
      .map(item => ({
        post: item.post.uri
      }))

    console.log(`Filtered down to ${filteredFeed.length} relevant posts`)
    
    // Remove duplicates
    const uniqueFeed = Array.from(new Set(filteredFeed.map(item => item.post)))
      .map(post => ({ post }))
    
    console.log(`Final feed has ${uniqueFeed.length} unique posts`)
    
    return {
      cursor: timelineResponse.data.cursor,
      feed: uniqueFeed
    }
  } catch (error) {
    console.error('Error in getFeedPosts:', error)
    throw error
  }
}

// Basic health check endpoint
app.get('/', (req, res) => {
  console.log('Health check request received')
  res.json({
    status: 'ok',
    message: 'Gay Men\'s Health Feed Generator is running',
    environmentStatus: {
      BLUESKY_USERNAME: process.env.BLUESKY_USERNAME ? '(set)' : '(not set)',
      BLUESKY_PASSWORD: process.env.BLUESKY_PASSWORD ? '(set)' : '(not set)',
    }
  })
})

// Well-known DID endpoint
app.get('/.well-known/did.json', (req, res) => {
  console.log('Serving DID document')
  res.json({
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": "did:web:gay-mens-health-feed-bsky-818b50b09c03.herokuapp.com",
    "alsoKnownAs": [],
    "authentication": [],
    "verificationMethod": [],
    "service": [{
      "id": "#bsky_fg",
      "type": "BskyFeedGenerator",
      "serviceEndpoint": "https://gay-mens-health-feed-bsky-818b50b09c03.herokuapp.com"
    }]
  })
})

// Feed endpoint
app.get('/xrpc/app.bsky.feed.getFeedSkeleton', async (req, res) => {
  console.log('Feed request received:', {
    feed: req.query.feed,
    cursor: req.query.cursor
  })
  try {
    const cursor = req.query.cursor
    const feed = await getFeedPosts(cursor)
    console.log('Successfully generated feed response')
    res.json(feed)
  } catch (error) {
    console.error('Error in feed endpoint:', error)
    res.status(500).json({ error: 'Failed to fetch feed', details: error.message })
  }
})

// Description endpoint
app.get('/xrpc/app.bsky.feed.describeFeedGenerator', (req, res) => {
  console.log('Serving feed generator description')
  res.json({
    did: 'did:web:gay-mens-health-feed-bsky-818b50b09c03.herokuapp.com',
    feeds: [{
      uri: 'at://did:web:gay-mens-health-feed-bsky-818b50b09c03.herokuapp.com/app.bsky.feed.generator/gay-mens-health',
      displayName: "Gay Men's Health",
      description: "A feed focused on gay men's health topics, including physical health, mental wellness, sexual health, and preventive care.",
      createdAt: new Date().toISOString()
    }]
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error', details: err.message })
})

// Start the server
app.listen(port, host, () => {
  console.log(`Gay men's health feed server running at http://${host}:${port}`)
})
