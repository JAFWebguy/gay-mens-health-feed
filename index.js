const { BskyAgent } = require('@atproto/api')
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
  'mens health',
  'sexual health',
  'mental health',
  'prep',
  'hiv prevention',
  'wellness',
  'healthcare',
  'fitness',
  'nutrition',
  'mental wellness',
  'preventive care'
]

async function getFeedPosts(cursor) {
  try {
    console.log('Attempting to login to Bluesky with username:', process.env.BLUESKY_USERNAME)
    await agent.login({
      identifier: process.env.BLUESKY_USERNAME,
      password: process.env.BLUESKY_PASSWORD
    })
    console.log('Successfully logged in to Bluesky')

    const limit = 30
    console.log('Fetching timeline with cursor:', cursor)
    const response = await agent.getTimeline({ limit, cursor })
    console.log(`Retrieved ${response.data.feed.length} posts from timeline`)
    
    // Filter posts containing health-related content
    const filteredFeed = response.data.feed
      .filter(item => {
        const postText = item.post.record.text.toLowerCase()
        return healthTopics.some(topic => postText.includes(topic.toLowerCase()))
      })
      .map(item => ({
        post: item.post.uri
      }))

    console.log(`Filtered down to ${filteredFeed.length} relevant posts`)
    return {
      cursor: response.data.cursor,
      feed: filteredFeed
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
    "service": [{
      "id": "#bsky_fg",
      "type": "BskyFeedGenerator",
      "serviceEndpoint": "https://gay-mens-health-feed-bsky-818b50b09c03.herokuapp.com"
    }]
  })
})

// Feed endpoint
app.get('/xrpc/app.bsky.feed.getFeedSkeleton', async (req, res) => {
  console.log('Feed request received with cursor:', req.query.cursor)
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
      description: "A feed focused on gay men's health topics, including physical health, mental wellness, sexual health, and preventive care."
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
