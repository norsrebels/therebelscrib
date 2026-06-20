// netlify/functions/identity-signup.js
// Netlify Identity webhook — fires on every new signup
// Automatically assigns "member" role to all self-registered users

exports.handler = async (event) => {
  try {
    const payload = JSON.parse(event.body)
    console.log('New signup:', payload.email)
    return {
      statusCode: 200,
      body: JSON.stringify({
        app_metadata: {
          roles: ['member']
        }
      })
    }
  } catch (err) {
    console.error('identity-signup error:', err)
    return { statusCode: 200, body: JSON.stringify({}) }
  }
}
