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
    console.log('Starting getFeedPosts with cursor:', cursor)
    
    // Login to Bluesky
    console.log('Attempting to login to Bluesky...')
    await agent.login({
      identifier: process.env.BLUESKY_USERNAME,
      password: process.env.BLUESKY_PASSWORD
    })
    console.log('Successfully logged in to Bluesky')

    let allPosts = []
    
    // Search terms to try, ordered by priority
    const searchTerms = [
      // Primary health terms
      'gay health',
      'lgbtq health',
      'queer health',
      'gay mental health',
      
      // Sexual health
      'prep hiv',
      'sexual health gay',
      'sti prevention',
      'hiv prevention',
      
      // Mental health
      'gay therapy',
      'lgbtq counseling',
      'queer mental health',
      
      // Physical health
      'gay fitness',
      'gay wellness',
      'gay nutrition',
      
      // Healthcare access
      'lgbtq healthcare',
      'gay doctor',
      'queer medical'
    ]

    // Try each search term
    for (const term of searchTerms) {
      try {
        console.log(`Searching for term: "${term}"`)
        const response = await agent.searchPosts({
          q: term,
          limit: 25
        })
        
        if (response?.data?.posts) {
          // Filter out retweets and ensure post has text
          const validPosts = response.data.posts.filter(post => 
            post?.record?.text && 
            !post.record.text.startsWith('RT ') &&
            !post.record.text.startsWith('rt ')
          )
          
          console.log(`Found ${validPosts.length} valid posts for term "${term}"`)
          allPosts = [...allPosts, ...validPosts]
        }
      } catch (error) {
        console.error(`Error searching for term "${term}":`, error.message)
      }
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log(`Total posts gathered from searches: ${allPosts.length}`)

    // Get some posts from the timeline as well
    try {
      const timelineResponse = await agent.getTimeline({ limit: 50 })
      if (timelineResponse?.data?.feed) {
        const timelinePosts = timelineResponse.data.feed
          .filter(item => {
            const text = item.post?.record?.text?.toLowerCase() || ''
            return (
              text.includes('health') || 
              text.includes('wellness') || 
              text.includes('medical') || 
              text.includes('prep') || 
              text.includes('hiv')
            ) && (
              text.includes('gay') || 
              text.includes('lgbtq') || 
              text.includes('queer')
            )
          })
          .map(item => item.post)
        
        console.log(`Got ${timelinePosts.length} relevant posts from timeline`)
        allPosts = [...allPosts, ...timelinePosts]
      }
    } catch (error) {
      console.error('Error fetching timeline:', error.message)
    }

    console.log(`Total posts after adding timeline: ${allPosts.length}`)

    // Remove duplicates and sort by recency
    const uniquePosts = new Map()
    for (const post of allPosts) {
      if (post?.uri && post?.indexedAt) {
        uniquePosts.set(post.uri, {
          post: post.uri,
          indexedAt: post.indexedAt
        })
      }
    }
    
    console.log(`Number of unique posts: ${uniquePosts.size}`)

    // Convert to array and sort by indexedAt
    const feedPosts = Array.from(uniquePosts.values())
      .sort((a, b) => new Date(b.indexedAt) - new Date(a.indexedAt))
      .map(({ post }) => ({ post }))

    console.log(`Final number of feed posts: ${feedPosts.length}`)

    // Log some sample posts for debugging
    const samplePosts = feedPosts.slice(0, 3)
    console.log('Sample posts:', JSON.stringify(samplePosts, null, 2))

    return {
      cursor: cursor || new Date().toISOString(),
      feed: feedPosts
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
    const feed = await getFeedPosts(req.query.cursor)
    console.log('Successfully generated feed response with', feed.feed.length, 'posts')
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
