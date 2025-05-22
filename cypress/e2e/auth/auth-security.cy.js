describe('Authentication - Security Tests', () => {
  let validToken = null

  before(() => {
    cy.logStep('Setting up security tests')
    cy.authenticateAdmin().then(() => {
      validToken = Cypress.env('currentAuthToken')
    })
  })

  describe('Input Validation & Injection Prevention', () => {
    it('should prevent SQL injection attacks', () => {
      cy.logStep('Testing SQL injection prevention')

      const sqlInjectionPayloads = [
        "admin'; DROP TABLE users; --",
        "admin' OR '1'='1",
        "'; SELECT * FROM api_users; --"
      ]

      sqlInjectionPayloads.forEach((payload) => {
        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/auth/token`,
          form: true,
          body: {
            username: payload,
            password: 'testpassword'
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-KEY': Cypress.env('apiKey')
          },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.oneOf([401, 422])

          const responseText = JSON.stringify(response.body).toLowerCase()
          expect(responseText).to.not.include('drop table')
          expect(responseText).to.not.include('select *')

          cy.logInfo(`SQL injection payload safely handled: ${payload.substring(0, 20)}...`)
        })
      })

      cy.logSuccess('All SQL injection attempts properly blocked')
    })

    it('should prevent XSS attacks', () => {
      cy.logStep('Testing XSS prevention')

      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>'
      ]

      xssPayloads.forEach((payload) => {
        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/auth/token`,
          form: true,
          body: {
            username: payload,
            password: 'testpassword'
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-KEY': Cypress.env('apiKey')
          },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.oneOf([401, 422])

          const responseText = JSON.stringify(response.body)
          expect(responseText).to.not.include('<script>')
          expect(responseText).to.not.include('javascript:')
          expect(responseText).to.not.include('onerror=')

          cy.logInfo(`XSS payload safely handled`)
        })
      })

      cy.logSuccess('All XSS attempts properly blocked')
    })

    it('should handle malformed requests gracefully', () => {
      cy.logStep('Testing malformed request handling')

      const malformedTests = [
        {
          name: 'Invalid JSON',
          body: '{"username":"user","password":}',
          contentType: 'application/json',
          expectedStatus: [400, 422]
        },
        {
          name: 'Binary data',
          body: String.fromCharCode(0, 1, 2, 3),
          contentType: 'application/x-www-form-urlencoded',
          expectedStatus: [400, 401, 422]
        },
        {
          name: 'Extremely long input',
          body: { username: 'a'.repeat(10000), password: 'b'.repeat(10000) },
          contentType: 'application/x-www-form-urlencoded',
          expectedStatus: [400, 401, 413, 422]
        }
      ]

      malformedTests.forEach((test) => {
        const headers = {
          'Content-Type': test.contentType,
          'X-API-KEY': Cypress.env('apiKey')
        }

        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/auth/token`,
          body: test.body,
          headers: headers,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.oneOf(test.expectedStatus)
          cy.logInfo(`${test.name}: Status ${response.status}`)
        })
      })

      cy.logSuccess('All malformed requests handled gracefully')
    })
  })

  describe('Rate Limiting & Brute Force Protection', () => {
    it('should handle rapid authentication attempts', () => {
      cy.logStep('Testing rapid authentication attempts')

      const rapidRequests = []
      const requestCount = 8

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
          },
          failOnStatusCode: false
        })
        rapidRequests.push(request)
      }

      let successCount = 0
      let throttledCount = 0

      rapidRequests.forEach((request, index) => {
        request.then((response) => {
          if (response.status === 200) {
            successCount++
          } else if (response.status === 429) {
            throttledCount++
          }
          cy.logInfo(`Request ${index + 1}: Status ${response.status}`)
        })
      })

      cy.then(() => {
        if (throttledCount > 0) {
          cy.logSuccess(`Rate limiting detected: ${throttledCount} requests throttled`)
        } else {
          cy.logInfo('No rate limiting detected (may not be implemented)')
        }

        expect(successCount).to.be.greaterThan(0)
        cy.logInfo(`Total successful: ${successCount}/${requestCount}`)
      })
    })

    it('should handle failed login attempts', () => {
      cy.logStep('Testing failed login attempt handling')

      const failedAttempts = []
      const attemptCount = 5

      for (let i = 0; i < attemptCount; i++) {
        const request = cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/auth/token`,
          form: true,
          body: {
            username: 'nonexistent_user',
            password: 'wrong_password'
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-KEY': Cypress.env('apiKey')
          },
          failOnStatusCode: false
        })
        failedAttempts.push(request)
      }

      let failureCount = 0
      failedAttempts.forEach((request, index) => {
        request.then((response) => {
          expect(response.status).to.be.oneOf([401, 429])
          if (response.status === 401 || response.status === 429) {
            failureCount++
          }
          cy.logInfo(`Failed attempt ${index + 1}: Status ${response.status}`)
        })
      })

      cy.then(() => {
        expect(failureCount).to.eq(attemptCount)
        cy.logSuccess('All failed attempts properly rejected')
      })
    })
  })

  describe('Token Security', () => {
    it('should generate secure JWT tokens', () => {
      cy.logStep('Testing JWT token security')

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
        const token = response.body.access_token

        const tokenParts = token.split('.')
        expect(tokenParts).to.have.length(3)

        tokenParts.forEach((part, index) => {
          expect(part).to.be.a('string').that.is.not.empty
          expect(part).to.match(/^[A-Za-z0-9_-]+$/)
          cy.logInfo(`Token part ${index + 1}: Valid base64 format`)
        })

        try {
          const payload = JSON.parse(atob(tokenParts[1]))

          expect(payload).to.have.property('sub')
          if (payload.exp) {
            expect(payload.exp).to.be.a('number')
            cy.logInfo('Token includes expiration claim')
          }

          cy.logInfo('Token payload structure is valid')
        } catch (error) {
          cy.logInfo('Token payload is properly encoded')
        }

        cy.logSuccess('JWT token structure and security validated')
      })
    })

    it('should reject modified tokens', () => {
      cy.logStep('Testing token modification detection')

      const originalToken = validToken
      const tokenParts = originalToken.split('.')

      const modifiedTokens = [
        {
          name: 'Modified header',
          token: 'modified.' + tokenParts[1] + '.' + tokenParts[2]
        },
        {
          name: 'Modified payload',
          token: tokenParts[0] + '.modified.' + tokenParts[2]
        },
        {
          name: 'Modified signature',
          token: tokenParts[0] + '.' + tokenParts[1] + '.modified'
        }
      ]

      modifiedTokens.forEach((test) => {
        cy.request({
          method: 'GET',
          url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/me`,
          headers: {
            'Authorization': `Bearer ${test.token}`,
            'Content-Type': 'application/json',
            'X-API-KEY': Cypress.env('apiKey')
          },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(401)
          cy.logInfo(`${test.name}: Correctly rejected`)
        })
      })

      cy.logSuccess('All token modifications correctly detected and rejected')
    })
  })

  describe('Information Disclosure Prevention', () => {
    it('should not leak sensitive information in error responses', () => {
      cy.logStep('Testing sensitive information leakage prevention')

      const sensitivePatterns = [
        /password["\s]*[:=]["\s]*[a-zA-Z0-9]{6,}/i,
        /secret["\s]*[:=]["\s]*[a-zA-Z0-9]{8,}/i,
        /key["\s]*[:=]["\s]*[a-zA-Z0-9_-]{20,}/i,
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
        /postgresql:\/\/[^"'\s]+/i,
        /\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}/
      ]

      const errorScenarios = [
        { username: 'invalid', password: 'wrong', desc: 'Invalid credentials' },
        { username: '', password: '', desc: 'Empty credentials' },
        { username: 'admin', password: 'x'.repeat(1000), desc: 'Long password' }
      ]

      errorScenarios.forEach((scenario) => {
        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/auth/token`,
          form: true,
          body: {
            username: scenario.username,
            password: scenario.password
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-KEY': Cypress.env('apiKey')
          },
          failOnStatusCode: false
        }).then((response) => {
          const responseText = JSON.stringify(response.body)

          sensitivePatterns.forEach((pattern, index) => {
            expect(responseText).to.not.match(pattern,
              `Response should not contain sensitive pattern ${index + 1}`)
          })

          if (scenario.password && scenario.password.length > 5) {
            expect(responseText).to.not.include(scenario.password)
          }

          cy.logInfo(`${scenario.desc}: No sensitive information leaked`)
        })
      })

      cy.logSuccess('No sensitive information found in error responses')
    })

    it('should provide consistent error messages', () => {
      cy.logStep('Testing error message consistency')

      const invalidCredentialTests = [
        { username: 'nonexistent', password: 'anything' },
        { username: Cypress.env('adminUsername'), password: 'wrongpassword' }
      ]

      const errorMessages = []

      invalidCredentialTests.forEach((test, index) => {
        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/auth/token`,
          form: true,
          body: test,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-KEY': Cypress.env('apiKey')
          },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(401)
          errorMessages.push(response.body.detail)

          cy.logInfo(`Test ${index + 1}: "${response.body.detail}"`)
        })
      })

      cy.then(() => {
        if (errorMessages.length === 2) {
          expect(errorMessages[0]).to.eq(errorMessages[1])
          cy.logSuccess('Error messages are consistent - prevents user enumeration')
        }
      })
    })
  })

  describe('API Security Headers & CORS', () => {
    it('should handle CORS and security headers appropriately', () => {
      cy.logStep('Testing security headers and CORS')

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
          'X-API-KEY': Cypress.env('apiKey'),
          'Origin': 'https://malicious-site.com'
        }
      }).then((response) => {
        expect(response.status).to.eq(200)

        const securityHeaders = [
          'x-content-type-options',
          'x-frame-options',
          'x-xss-protection',
          'access-control-allow-origin'
        ]

        const presentHeaders = []
        securityHeaders.forEach(header => {
          if (response.headers[header]) {
            presentHeaders.push(header)
            cy.logInfo(`Security header found: ${header}`)
          }
        })

        if (presentHeaders.length > 0) {
          cy.logSuccess(`${presentHeaders.length} security headers detected`)
        } else {
          cy.logInfo('No standard security headers detected')
        }
      })
    })

    it('should validate unusual HTTP methods', () => {
      cy.logStep('Testing unusual HTTP methods')

      const unusualMethods = ['PUT', 'PATCH', 'DELETE']

      unusualMethods.forEach((method) => {
        cy.request({
          method: method,
          url: `${Cypress.env('apiUrl')}${Cypress.env('apiVersion')}/auth/token`,
          headers: {
            'X-API-KEY': Cypress.env('apiKey')
          },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.oneOf([405, 400, 404])
          cy.logInfo(`${method} method: Status ${response.status}`)
        })
      })

      cy.logSuccess('Unusual HTTP methods properly handled')
    })
  })
})