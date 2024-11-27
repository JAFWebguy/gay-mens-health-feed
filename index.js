const { BskyAgent } = require('@atproto/api')
const express = require('express')
const dotenv = require('dotenv')

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
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
    await agent.login({
      identifier: process.env.BLUESKY_USERNAME,
      password: process.env.BLUESKY_PASSWORD
    })

    const limit = 30
    const response = await agent.getTimeline({ limit, cursor })
    
    // Filter posts containing health-related content
    const filteredFeed = response.data.feed
      .filter(item => {
        const postText = item.post.record.text.toLowerCase()
        return healthTopics.some(topic => postText.includes(topic.toLowerCase()))
      })
      .map(item => ({
        post: item.post.uri
      }))

    return {
      cursor: response.data.cursor,
      feed: filteredFeed
    }
  } catch (error) {
    console.error('Error fetching feed:', error)
    throw error
  }
}

// Well-known DID endpoint
app.get('/.well-known/did.json', (req, res) => {
  res.json({
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": "did:web:gay-mens-health-feed-bsky.herokuapp.com",
    "service": [{
      "id": "#bsky_fg",
      "type": "BskyFeedGenerator",
      "serviceEndpoint": "https://gay-mens-health-feed-bsky.herokuapp.com"
    }]
  })
})

// Feed endpoint
app.get('/xrpc/app.bsky.feed.getFeedSkeleton', async (req, res) => {
  try {
    const cursor = req.query.cursor
    const feed = await getFeedPosts(cursor)
    res.json(feed)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feed' })
  }
})

// Description endpoint
app.get('/xrpc/app.bsky.feed.describeFeedGenerator', (req, res) => {
  res.json({
    did: 'did:web:gay-mens-health-feed-bsky.herokuapp.com',
    feeds: [{
      uri: 'at://did:web:gay-mens-health-feed-bsky.herokuapp.com/app.bsky.feed.generator/gay-mens-health',
      displayName: "Gay Men's Health",
      description: "A feed focused on gay men's health topics, including physical health, mental wellness, sexual health, and preventive care."
    }]
  })
})

app.listen(port, () => {
  console.log(`Gay men's health feed server running on port ${port}`)
})
