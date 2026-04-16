const env = require('./src/config/env')
const app = require('./src/app')

app.listen(env.port, () => {
  console.log(`API listening on port ${env.port}`)
})
