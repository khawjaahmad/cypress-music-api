describe('Authentication - Core Tests', () => {
  let testToken = null
  let createdUsers = []

  
  after(() => {
    cy.logStep('Cleaning up authentication test data')

    if (createdUsers.length > 0) {
      cy.cleanupTestUsers(createdUsers.map(u => u.id))
    }
  })

  describe('Basic Authentication Flow', () => {
    it('should authenticate admin with valid credentials', () => {
      cy.logStep('Testing admin authentication')

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
        expect(response.body).to.have.property('token_type', 'bearer')
        expect(response.body).to.have.property('user')

        const user = response.body.user
        expect(user).to.have.property('username', Cypress.env('adminUsername'))
        expect(user).to.have.property('is_admin', true)
        expect(user).to.have.property('is_active', true)

        testToken = response.body.access_token

        cy.validateAuthTokenSchema(response.body)
        cy.logSuccess('Admin authentication successful')
      })
    })

    it('should reject invalid credentials', () => {
      cy.logStep('Testing invalid credential rejection')

      const invalidTests = [
        { username: 'invaliduser', password: Cypress.env('adminPassword'), desc: 'invalid username' },
        { username: Cypress.env('adminUsername'), password: 'wrongpassword', desc: 'invalid password' },
        { username: '', password: '', desc: 'empty credentials' }
      ]

      invalidTests.forEach((test) => {
        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/auth/token`,
          form: true,
          body: {
            username: test.username,
            password: test.password
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-KEY': Cypress.env('apiKey')
          },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.oneOf([400, 401, 422])
          expect(response.body).to.have.property('detail')
          cy.logInfo(`${test.desc}: Status ${response.status}`)
        })
      })

      cy.logSuccess('All invalid credentials correctly rejected')
    })

    it('should require API key for authentication', () => {
      cy.logStep('Testing API key requirement')

      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/auth/token`,
        form: true,
        body: {
          username: Cypress.env('adminUsername'),
          password: Cypress.env('adminPassword')
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([401, 403])
        expect(response.body).to.have.property('detail')
        expect(response.body.detail).to.include('Invalid API key')

        cy.logSuccess('API key requirement enforced')
      })
    })
  })

  describe('Token Usage & Protected Endpoints', () => {
    beforeEach(() => {
      if (!testToken) {
        cy.authenticateAdmin().then(() => {
          testToken = Cypress.env('currentAuthToken')
        })
      }
    })

    it('should access protected endpoints with valid token', () => {
      cy.logStep('Testing protected endpoint access')

      const headers = {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json',
        'X-API-KEY': Cypress.env('apiKey')
      }

      cy.request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/me`,
        headers: headers
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('username', Cypress.env('adminUsername'))
        expect(response.body).to.have.property('is_admin', true)

        cy.logSuccess('Protected endpoint access successful')
      })
    })

    it('should reject access with invalid or missing tokens', () => {
      cy.logStep('Testing invalid token rejection')

      const invalidTokenTests = [
        {
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': Cypress.env('apiKey') },
          desc: 'no token'
        },
        {
          headers: {
            'Authorization': 'Bearer invalid-token',
            'Content-Type': 'application/json',
            'X-API-KEY': Cypress.env('apiKey')
          },
          desc: 'invalid token'
        },
        {
          headers: {
            'Authorization': testToken, 
            'Content-Type': 'application/json',
            'X-API-KEY': Cypress.env('apiKey')
          },
          desc: 'malformed auth header'
        }
      ]

      invalidTokenTests.forEach((test) => {
        cy.request({
          method: 'GET',
          url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/me`,
          headers: test.headers,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.oneOf([401, 422])
          expect(response.body).to.have.property('detail')
          cy.logInfo(`${test.desc}: Status ${response.status}`)
        })
      })

      cy.logSuccess('All invalid tokens correctly rejected')
    })

    it('should handle token tampering detection', () => {
      cy.logStep('Testing token tampering detection')

      const tokenParts = testToken.split('.')
      const tamperedToken = `${tokenParts[0]}.${tokenParts[1]}.invalid`

      cy.request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/me`,
        headers: {
          'Authorization': `Bearer ${tamperedToken}`,
          'Content-Type': 'application/json',
          'X-API-KEY': Cypress.env('apiKey')
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('detail')

        cy.logSuccess('Token tampering correctly detected and rejected')
      })
    })
  })

  describe('User Management Integration', () => {
    beforeEach(() => {
      cy.authenticateAdmin()
    })

    it('should create and manage users with proper authentication', () => {
      cy.logStep('Testing user creation with authentication')

      cy.generateTestUsers(1).then((users) => {
        const userData = users[0]

        cy.createUser(userData).then((createdUser) => {
          createdUsers.push(createdUser)

          expect(createdUser).to.have.property('id')
          expect(createdUser.username).to.eq(userData.username)
          expect(createdUser.email).to.eq(userData.email)

          cy.validateUserSchema(createdUser)
          cy.logSuccess(`User created: ${createdUser.username}`)

          
          cy.getUserById(createdUser.id).then((retrievedUser) => {
            expect(retrievedUser.id).to.eq(createdUser.id)
            expect(retrievedUser.username).to.eq(createdUser.username)

            cy.logSuccess('User retrieval successful')
          })

          
          const updateData = { username: `updated_${userData.username}` }
          cy.updateUser(createdUser.id, updateData).then((updatedUser) => {
            expect(updatedUser.username).to.eq(updateData.username)

            cy.logSuccess('User update successful')
          })
        })
      })
    })

    it('should enforce admin permissions for user operations', () => {
      cy.logStep('Testing admin permission enforcement')

      cy.request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/users/`,
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': Cypress.env('apiKey')
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([401, 403])
        expect(response.body).to.have.property('detail')

        cy.logSuccess('Admin permissions correctly enforced')
      })
    })
  })

  describe('Session Management', () => {
    it('should maintain session consistency across requests', () => {
      cy.logStep('Testing session consistency')

      cy.authenticateAdmin().then(() => {
        const headers = {
          'Authorization': `Bearer ${Cypress.env('currentAuthToken')}`,
          'Content-Type': 'application/json',
          'X-API-KEY': Cypress.env('apiKey')
        }

        const requests = Array(3).fill().map(() => {
          return cy.request({
            method: 'GET',
            url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/me`,
            headers: headers
          })
        })

        let firstResponse = null
        requests.forEach((request, index) => {
          request.then((response) => {
            expect(response.status).to.eq(200)

            if (index === 0) {
              firstResponse = response.body
            } else {
              expect(response.body.id).to.eq(firstResponse.id)
              expect(response.body.username).to.eq(firstResponse.username)
            }

            cy.logInfo(`Request ${index + 1}: Consistent user data`)
          })
        })

        cy.logSuccess('Session consistency maintained')
      })
    })

    it('should handle concurrent authentication requests', () => {
      cy.logStep('Testing concurrent authentication')

      const concurrentRequests = []
      const requestCount = 3

      for (let i = 0; i < requestCount; i++) {
        const request = cy.request({
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
        })
        concurrentRequests.push(request)
      }

      let successCount = 0
      concurrentRequests.forEach((request, index) => {
        request.then((response) => {
          if (response.status === 200) {
            successCount++
            expect(response.body).to.have.property('access_token')
          }
          cy.logInfo(`Concurrent auth ${index + 1}: Status ${response.status}`)
        })
      })

      cy.then(() => {
        expect(successCount).to.be.greaterThan(0)
        cy.logSuccess(`Concurrent authentication: ${successCount}/${requestCount} successful`)
      })
    })
  })
})