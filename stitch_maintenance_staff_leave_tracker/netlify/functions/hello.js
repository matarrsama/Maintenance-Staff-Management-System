// Sample Netlify Function. Deploy this project to Netlify and call:
//   GET /.netlify/functions/hello
// Use this directory for future server-side logic (email notifications,
// report generation, leave-conflict checks, etc).
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello from a Netlify function.', ok: true }),
  };
};
