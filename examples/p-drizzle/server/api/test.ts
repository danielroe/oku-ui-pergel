export default defineEventHandler(async (event) => {
  const connect = await pergelRocket().drizzle().postgresjs().connect({
    event,
  })
  const result = await connect.select().from(rocketTables.user)
  return {
    statusCode: 200,
    body: result,
  }
})
