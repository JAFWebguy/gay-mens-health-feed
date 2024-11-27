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
    
    let allPosts = []
    
    // Search for specific terms
    const searchTerms = [
      'gay health',
      'lgbtq health',
      'prep hiv',
      'gay mental health',
      'queer health',
      'gay wellness',
      'gay healthcare',
      'gay fitness',
      'gay doctor',
      'gay therapy'
    ]
    
    // Search for each term
    for (const term of searchTerms) {
      try {
        console.log(`Searching for term: ${term}`)
        const response = await agent.searchPosts({ q: term, limit: 20 })
        if (response.data.posts) {
          allPosts = [...allPosts, ...response.data.posts.map(post => ({ post }))]
        }
      } catch (error) {
        console.log(`Could not search for term ${term}:`, error.message)
      }
      
      // Add a small delay between searches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Get posts from the general timeline as well
    try {
      const timelineResponse = await agent.getTimeline({ limit, cursor })
      allPosts = [...allPosts, ...timelineResponse.data.feed]
    } catch (error) {
      console.log('Could not fetch timeline:', error.message)
    }
    
    console.log(`Retrieved ${allPosts.length} total posts`)
    
    // Filter posts
    const filteredFeed = allPosts
      .filter(item => {
        if (!item.post?.record?.text) return false
        const postText = item.post.record.text.toLowerCase()
        
        // Check for LGBTQ+ terms
        const lgbtqTerms = ['gay', 'lgbtq', 'queer', 'lgbt', 'pride']
        const hasLGBTQ = lgbtqTerms.some(term => postText.includes(term))
        
        // Check for health terms
        const healthTerms = ['health', 'wellness', 'medical', 'doctor', 'therapy', 'mental', 
                           'fitness', 'prep', 'hiv', 'healthcare', 'clinic', 'prevention']
        const hasHealth = healthTerms.some(term => postText.includes(term))
        
        // Accept posts that either:
        // 1. Have both LGBTQ and health context, OR
        // 2. Contain specific combined phrases
        const specificPhrases = [
          'gay health',
          'lgbtq health',
          'queer health',
          'gay doctor',
          'gay therapy',
          'gay mental',
          'gay medical',
          'prep hiv',
          'gay wellness',
          'gay fitness'
        ]
        
        const hasSpecificPhrase = specificPhrases.some(phrase => postText.includes(phrase))
        
        return hasSpecificPhrase || (hasLGBTQ && hasHealth)
      })
      .map(item => ({
        post: item.post.uri
      }))

    console.log(`Filtered down to ${filteredFeed.length} relevant posts`)
    
    // Remove duplicates
    const uniquePosts = new Map()
    for (const item of filteredFeed) {
      uniquePosts.set(item.post, item)
    }
    const uniqueFeed = Array.from(uniquePosts.values())
    
    console.log(`Final feed has ${uniqueFeed.length} unique posts`)
    
    return {
      cursor: cursor,
      feed: uniqueFeed.slice(0, 50) // Limit to 50 posts max
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
