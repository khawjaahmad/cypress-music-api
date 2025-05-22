import './commands'

beforeEach(() => {
  cy.log('Starting test execution')
})

afterEach(() => {
  cy.log('Test execution completed')
})

Cypress.on('uncaught:exception', (err, runnable) => {
  console.error('Uncaught exception:', err)
  return false
})

Cypress.Commands.add('logStep', (message) => {
  cy.log(`🔍 STEP: ${message}`)
  cy.task('log', `STEP: ${message}`)
})

Cypress.Commands.add('logInfo', (message) => {
  cy.log(`ℹ️ INFO: ${message}`)
  cy.task('log', `INFO: ${message}`)
})

Cypress.Commands.add('logError', (message) => {
  cy.log(`❌ ERROR: ${message}`)
  cy.task('log', `ERROR: ${message}`)
})

Cypress.Commands.add('logSuccess', (message) => {
  cy.log(`✅ SUCCESS: ${message}`)
  cy.task('log', `SUCCESS: ${message}`)
})