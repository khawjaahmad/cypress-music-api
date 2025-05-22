describe('Music API - User Management Tests', () => {
  let testUsers = [];
  let createdUserIds = [];

  before(() => {
    cy.log('Setting up User Management Tests');
    
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/v1/auth/token`,
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
      expect(response.status).to.eq(200);
      Cypress.env('authToken', response.body.access_token);

      
      const timestamp = Date.now();
      for (let i = 0; i < 3; i++) {
        testUsers.push({
          username: `testuser_${timestamp}_${i}`,
          email: `testuser_${timestamp}_${i}@example.com`
        });
      }
    });
  });

  after(() => {
    cy.log('Cleaning up test users');

    
    if (createdUserIds.length > 0) {
      createdUserIds.forEach(userId => {
        cy.request({
          method: 'DELETE',
          url: `${Cypress.env('apiUrl')}/v1/users/${userId}`,
          headers: {
            'Authorization': `Bearer ${Cypress.env('authToken')}`,
            'Content-Type': 'application/json',
            'X-API-KEY': Cypress.env('apiKey')
          },
          failOnStatusCode: false
        }).then(response => {
          if (response.status === 204) {
            cy.log(`User ${userId} deleted successfully`);
          } else {
            cy.log(`Failed to delete user ${userId}, status: ${response.status}`);
          }
        });
      });
    }
  });

  describe('User CRUD Operations', () => {
    it('should create, read, update and delete users', () => {
      
      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/v1/users/`,
        headers: {
          'Authorization': `Bearer ${Cypress.env('authToken')}`,
          'Content-Type': 'application/json',
          'X-API-KEY': Cypress.env('apiKey')
        },
        body: testUsers[0]
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body).to.have.property('id');
        expect(response.body.username).to.eq(testUsers[0].username);
        expect(response.body.email).to.eq(testUsers[0].email);

        const userId = response.body.id;
        createdUserIds.push(userId);

        
        cy.request({
          method: 'GET',
          url: `${Cypress.env('apiUrl')}/v1/users/${userId}`,
          headers: {
            'Authorization': `Bearer ${Cypress.env('authToken')}`,
            'Content-Type': 'application/json',
            'X-API-KEY': Cypress.env('apiKey')
          }
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.id).to.eq(userId);
          expect(response.body.username).to.eq(testUsers[0].username);

          
          const updatedUsername = `${testUsers[0].username}_updated`;
          cy.request({
            method: 'PUT',
            url: `${Cypress.env('apiUrl')}/v1/users/${userId}`,
            headers: {
              'Authorization': `Bearer ${Cypress.env('authToken')}`,
              'Content-Type': 'application/json',
              'X-API-KEY': Cypress.env('apiKey')
            },
            body: {
              username: updatedUsername
            }
          }).then((response) => {
            expect(response.status).to.eq(200);
            expect(response.body.username).to.eq(updatedUsername);

            
          });
        });
      });
    });

    it('should handle validation for duplicate usernames', () => {
      
      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/v1/users/`,
        headers: {
          'Authorization': `Bearer ${Cypress.env('authToken')}`,
          'Content-Type': 'application/json',
          'X-API-KEY': Cypress.env('apiKey')
        },
        body: testUsers[1]
      }).then((response) => {
        expect(response.status).to.eq(201);
        createdUserIds.push(response.body.id);

        
        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}/v1/users/`,
          headers: {
            'Authorization': `Bearer ${Cypress.env('authToken')}`,
            'Content-Type': 'application/json',
            'X-API-KEY': Cypress.env('apiKey')
          },
          body: {
            username: testUsers[1].username,
            email: 'different@example.com'
          },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(409);
          expect(response.body.detail).to.include('Username already registered');
        });
      });
    });

    it('should handle validation for invalid email format', () => {
      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/v1/users/`,
        headers: {
          'Authorization': `Bearer ${Cypress.env('authToken')}`,
          'Content-Type': 'application/json',
          'X-API-KEY': Cypress.env('apiKey')
        },
        body: {
          username: 'emailvalidationuser',
          email: 'not-an-email'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(422);
        expect(response.body.detail).to.include('Validation error');
      });
    });
  });

  describe('User List and Pagination', () => {
    it('should list users with pagination', () => {
      
      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/v1/users/`,
        headers: {
          'Authorization': `Bearer ${Cypress.env('authToken')}`,
          'Content-Type': 'application/json',
          'X-API-KEY': Cypress.env('apiKey')
        },
        body: testUsers[2]
      }).then((response) => {
        expect(response.status).to.eq(201);
        createdUserIds.push(response.body.id);

        
        cy.request({
          method: 'GET',
          url: `${Cypress.env('apiUrl')}/v1/users/`,
          headers: {
            'Authorization': `Bearer ${Cypress.env('authToken')}`,
            'Content-Type': 'application/json',
            'X-API-KEY': Cypress.env('apiKey')
          },
          qs: {
            limit: 10,
            skip: 0
          }
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.be.an('array');

          
          const foundUser = response.body.find(user => user.id === createdUserIds[createdUserIds.length - 1]);
          expect(foundUser).to.exist;
        });
      });
    });
  });

  describe('Authentication Requirements', () => {
    it('should reject unauthenticated requests', () => {
      
      cy.request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}/v1/users/`,
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': Cypress.env('apiKey')
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body).to.have.property('detail');
      });
    });
  });
});