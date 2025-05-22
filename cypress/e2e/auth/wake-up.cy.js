describe('Backend Wake-up Service', () => {
  before(() => {
    cy.log('🚀 Initializing backend service...')
  })

  it('should wake up the backend service and verify it is operational', () => {
    cy.logStep('Waking up backend service')

    
    cy.request({
      method: 'GET',
      url: `${Cypress.env('apiUrl')}/`,
      timeout: 45000, 
      headers: {
        'X-API-KEY': Cypress.env('apiKey')
      },
      failOnStatusCode: false
    }).then((response) => {
      cy.logInfo(`Wake-up response: ${response.status}`)

      if (response.status === 200) {
        cy.logSuccess('Backend service is awake and responding')
      } else {
        cy.logInfo('Backend service responded - warming up...')
      }
    })

    cy.wait(3000)

    cy.request({
      method: 'GET',
      url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/healthcheck`,
      timeout: 15000,
      headers: {
        'X-API-KEY': Cypress.env('apiKey')
      },
      retries: 3
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'healthy')

      cy.logSuccess('✅ Healthcheck passed - backend fully operational')
      cy.logInfo(`Database: ${response.body.database_connection}`)
    })

    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/auth/token`,
      form: true,
      body: {
        username: Cypress.env('adminUsername'),
        password: Cypress.env('adminPassword')
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-API-KEY': Cypress.env('apiKey')
      }
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('access_token')

      cy.logSuccess('✅ Authentication verified - backend ready for testing')

      cy.wrap(response.body.access_token).as('globalAuthToken')
    })
  })
})