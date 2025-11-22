/**
 * Test Kindo API with correct header format
 */

require('dotenv').config();
const axios = require('axios');

const EMERGENT_LLM_KEY = process.env.EMERGENT_LLM_KEY;

console.log('Testing Kindo API with correct format\n');
console.log('='.repeat(50));
console.log('Key:', EMERGENT_LLM_KEY);
console.log('='.repeat(50));

async function testKindo() {
  try {
    console.log('\n📝 Sending test message...');
    
    const response = await axios.post(
      'https://llm.kindo.ai/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "Hello! I am working correctly with Kindo." and nothing else.' }
        ]
      },
      {
        headers: {
          'content-type': 'application/json',
          'api-key': EMERGENT_LLM_KEY
        },
        timeout: 30000
      }
    );

    console.log('\n✅ Success!');
    console.log('Response:', response.data.choices[0].message.content);
    console.log('\nFull response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error:');
    console.error('Message:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testKindo();
