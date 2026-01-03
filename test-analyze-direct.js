// Direct test of analyze endpoint
const handler = require('./api/analyze');

// Mock request/response
const req = {
  method: 'POST',
  body: {
    userId: '17b5ae73-d16a-40bc-8db3-8bc295b063df'
  }
};

const res = {
  status: (code) => {
    console.log('Response status:', code);
    return res;
  },
  json: (data) => {
    console.log('Response data:', JSON.stringify(data, null, 2));
    return res;
  }
};

console.log('Testing analyze endpoint...');
handler(req, res)
  .then(() => console.log('\nTest completed'))
  .catch(err => console.error('\nTest failed:', err));
