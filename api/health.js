/**
 * HEALTH CHECK
 * Simple endpoint to verify backend is deployed and responding
 */

module.exports = async function handler(req, res) {
  return res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    message: 'Backend is healthy',
  });
};
