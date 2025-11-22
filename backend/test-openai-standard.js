/**
 * Test Emergent key with standard OpenAI endpoint
 */

require('dotenv').config();
const OpenAI = require('openai');

const EMERGENT_LLM_KEY = process.env.EMERGENT_LLM_KEY;

console.log('Testing with standard OpenAI endpoint\n');
console.log('='.repeat(50));

// Try with default OpenAI endpoint
const openaiClient = new OpenAI({
  apiKey: EMERGENT_LLM_KEY
  // No baseURL - use default OpenAI endpoint
});

async function testOpenAI() {
  try {
    console.log('\n📝 Sending test message to OpenAI with Emergent key...');
    
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello! I am working correctly." and nothing else.' }
      ],
    });

    console.log('\n✅ Success!');
    console.log('Response:', response.choices[0].message.content);
    
  } catch (error) {
    console.error('\n❌ Error:');
    console.error('Message:', error.message);
    console.error('Status:', error.status);
    console.error('Type:', error.type);
    
    if (error.code) {
      console.error('Code:', error.code);
    }
  }
}

testOpenAI();
