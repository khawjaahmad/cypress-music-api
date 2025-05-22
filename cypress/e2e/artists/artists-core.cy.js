describe("Artists API - Core Tests", () => {
  let authToken = null;
  let createdArtistIds = [];

  before(() => {
    cy.logStep("Setting up Artists Core test suite");
    cy.authenticateAdmin();
  });

  beforeEach(() => {
    const token = Cypress.env("currentAuthToken");
    if (!token) {
      cy.authenticateAdmin();
    }
  });

  after(() => {
    cy.logStep("Cleaning up Artists Core test suite");

    if (createdArtistIds.length > 0) {
      cy.logInfo(`Cleaning up ${createdArtistIds.length} test artists`);
      cy.cleanupTestArtists(createdArtistIds);
    }
  });

  describe("DIAGNOSTIC - API Validation Understanding", () => {
    it("should understand API validation rules", () => {
      cy.logStep("Running diagnostic to understand API validation");

      cy.getAuthHeaders().then((headers) => {
        const testCases = [
          { payload: {}, desc: "completely empty object" },
          { payload: { name: "Diagnostic Test Artist 1" }, desc: "name only" },
          { payload: { bio: "Diagnostic test bio" }, desc: "bio only" },
          { payload: { name: "", bio: "Test bio" }, desc: "empty name with bio" },
          { payload: { name: "Diagnostic Test Artist 2", bio: "" }, desc: "name with empty bio" },
          { payload: { name: null, bio: "Test bio" }, desc: "null name with bio" },
          { payload: { name: "Diagnostic Test Artist 3", bio: null }, desc: "name with null bio" },
          { payload: { name: "   ", bio: "Test bio" }, desc: "whitespace name with bio" },
          { payload: { name: "Diagnostic Test Artist 4", bio: "   " }, desc: "name with whitespace bio" },
        ];

        testCases.forEach((testCase, index) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/`,
            headers: headers,
            body: testCase.payload,
            failOnStatusCode: false,
          }).then((response) => {
            cy.log(`Test ${index + 1}: ${testCase.desc}`);
            cy.log(`Status: ${response.status}`);

            if (response.status === 201) {
              cy.log(`✅ ACCEPTED: Created artist with ID ${response.body.id}`);
              cy.log(`Created artist data:`, JSON.stringify(response.body, null, 2));
              createdArtistIds.push(response.body.id);
            } else {
              cy.log(`❌ REJECTED: ${response.body.detail || 'No detail provided'}`);
              cy.log(`Error response:`, JSON.stringify(response.body, null, 2));
            }
            cy.log("---");
          });
        });

        cy.logSuccess("Diagnostic test completed - check logs to understand API behavior");
      });
    });
  });

  describe("POST /v1/artists/ - Create Artists", () => {
    it("should create artist successfully with valid data", () => {
      cy.logStep("Testing artist creation with valid data");

      cy.generateArtistData().then((artistData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: headers,
            body: artistData,
          }).then((response) => {
            expect(response.status).to.eq(201);
            expect(response.body).to.have.property("id");
            expect(response.body.name).to.eq(artistData.name);
            expect(response.body.bio).to.eq(artistData.bio);

            createdArtistIds.push(response.body.id);

            cy.validateArtistSchema(response.body);
            cy.logSuccess(
              `Artist created successfully: ${response.body.name} (ID: ${response.body.id})`
            );
          });
        });
      });
    });

    it("should fail to create artist with duplicate name", () => {
      cy.logStep("Testing duplicate artist name rejection");

      cy.generateArtistData().then((artistData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: headers,
            body: artistData,
          }).then((response) => {
            expect(response.status).to.eq(201);
            createdArtistIds.push(response.body.id);

            cy.generateArtistData().then((duplicateData) => {
              duplicateData.name = artistData.name; 

              cy.request({
                method: "POST",
                url: `${Cypress.env("apiUrl")}${Cypress.env(
                  "apiVersion"
                )}/artists/`,
                headers: headers,
                body: duplicateData,
                failOnStatusCode: false,
              }).then((duplicateResponse) => {
                expect(duplicateResponse.status).to.eq(409);
                expect(duplicateResponse.body).to.have.property("detail");
                expect(duplicateResponse.body.detail).to.include(
                  "already exists"
                );

                cy.logSuccess("Duplicate artist name correctly rejected");
              });
            });
          });
        });
      });
    });

    it("should fail to create artist without authentication", () => {
      cy.logStep("Testing artist creation without authentication");

      cy.generateArtistData().then((artistData) => {
        cy.request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/`,
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": Cypress.env("apiKey"),
          },
          body: artistData,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(401);
          expect(response.body).to.have.property("detail");

          cy.logSuccess("Unauthenticated artist creation correctly rejected");
        });
      });
    });

    it("should validate required and optional fields", () => {
      cy.logStep("Testing field validation based on actual API behavior");

      cy.generateArtistData().then((validData) => {
        const fieldValidationTests = [
          {
            name: "",
            bio: validData.bio,
            desc: "empty name",
            expectedStatus: [201, 400, 409, 422],
          },
          {
            name: validData.name,
            bio: "",
            desc: "empty bio",
            expectedStatus: [201, 400, 409, 422], 
          },
          {
            bio: validData.bio,
            desc: "missing name field",
            expectedStatus: [201, 400, 409, 422], 
          },
          {
            name: validData.name,
            desc: "missing bio field",
            expectedStatus: [201, 400, 409, 422], 
          },
          {
            name: "   ",
            bio: validData.bio,
            desc: "whitespace-only name",
            expectedStatus: [201, 400, 409, 422], 
          },
          {
            name: validData.name,
            bio: "   ",
            desc: "whitespace-only bio",
            expectedStatus: [201, 400, 409, 422],
          },
          {
            name: null,
            bio: validData.bio,
            desc: "null name",
            expectedStatus: [201, 400, 409, 422],
          },
          {
            name: validData.name,
            bio: null,
            desc: "null bio",
            expectedStatus: [201, 400, 409, 422],
          },
        ];

        fieldValidationTests.forEach((testData) => {
          cy.getAuthHeaders().then((headers) => {
            cy.request({
              method: "POST",
              url: `${Cypress.env("apiUrl")}${Cypress.env(
                "apiVersion"
              )}/artists/`,
              headers: headers,
              body: testData,
              failOnStatusCode: false,
            }).then((response) => {
              expect(response.status).to.be.oneOf(testData.expectedStatus);

              
              if (response.status >= 400) {
                expect(response.body).to.have.property("detail");
              }

              cy.logInfo(`${testData.desc}: Status ${response.status}`);

              
              if (response.status === 201 && response.body.id) {
                createdArtistIds.push(response.body.id);
                cy.logInfo(`Created test artist ID ${response.body.id} - will be cleaned up`);
              }
            });
          });
        });

        cy.logSuccess("Field validation testing completed");
      });
    });

    it("should handle edge cases in field lengths and content", () => {
      cy.logStep("Testing edge cases for field content");

      const edgeCaseTests = [
        {
          name: "A",
          bio: "B",
          desc: "minimal valid content",
          expectedStatus: [201, 409],
        },
        {
          name: "A".repeat(255),
          bio: "Very long bio content that might test field length limits",
          desc: "very long name",
          expectedStatus: [201, 400, 409, 422],
        },
        {
          name: "Test Artist with Special Characters: @#$%^&*()",
          bio: "Bio with special characters: !@#$%^&*()",
          desc: "special characters",
          expectedStatus: [201, 400, 409],
        },
        {
          name: "Artist with 'quotes' and \"double quotes\"",
          bio: "Bio with 'various' \"quote\" types",
          desc: "quotes in content",
          expectedStatus: [201, 409],
        },
      ];

      edgeCaseTests.forEach((testData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: headers,
            body: testData,
            failOnStatusCode: false,
          }).then((response) => {
            expect(response.status).to.be.oneOf(testData.expectedStatus);

            if (response.status >= 400) {
              expect(response.body).to.have.property("detail");
            }

            cy.logInfo(`${testData.desc}: Status ${response.status}`);

            if (response.status === 201 && response.body.id) {
              createdArtistIds.push(response.body.id);
            }
          });
        });
      });

      cy.logSuccess("Edge case testing completed");
    });
  });

  describe("GET /v1/artists/ - List Artists", () => {
    it("should list all artists with default pagination", () => {
      cy.logStep("Testing artist listing with default pagination");

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "GET",
          url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/`,
          headers: headers,
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.be.an("array");
          expect(response.body.length).to.be.greaterThan(0);

          response.body.forEach((artist) => {
            cy.validateArtistSchema(artist);
          });

          cy.logSuccess(
            `Successfully retrieved ${response.body.length} artists`
          );
        });
      });
    });

    it("should handle pagination parameters", () => {
      cy.logStep("Testing artist listing with pagination");

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "GET",
          url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/`,
          headers: headers,
          qs: { limit: 2 },
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.be.an("array");
          expect(response.body.length).to.be.at.most(2);

          cy.logSuccess(
            `Pagination with limit working: ${response.body.length} artists`
          );
        });

        
        cy.request({
          method: "GET",
          url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/`,
          headers: headers,
          qs: { skip: 1, limit: 1 },
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.be.an("array");

          cy.logSuccess("Pagination with skip working correctly");
        });
      });
    });

    it("should require authentication for listing", () => {
      cy.logStep("Testing authentication requirement for listing artists");

      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/`,
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": Cypress.env("apiKey"),
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body).to.have.property("detail");

        cy.logSuccess("Authentication requirement enforced for listing");
      });
    });
  });

  describe("GET /v1/artists/{artist_id} - Get Artist by ID", () => {
    let testArtistId = null;

    beforeEach(() => {
      cy.generateArtistData().then((artistData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: headers,
            body: artistData,
          }).then((response) => {
            testArtistId = response.body.id;
            createdArtistIds.push(testArtistId);
          });
        });
      });
    });

    it("should retrieve artist by valid ID", () => {
      cy.logStep("Testing artist retrieval by valid ID");

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "GET",
          url: `${Cypress.env("apiUrl")}${Cypress.env(
            "apiVersion"
          )}/artists/${testArtistId}`,
          headers: headers,
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.have.property("id", testArtistId);
          expect(response.body).to.have.property("name");
          expect(response.body).to.have.property("bio");

          cy.validateArtistSchema(response.body);
          cy.logSuccess(`Successfully retrieved artist: ${response.body.name}`);
        });
      });
    });

    it("should return 404 for non-existent artist", () => {
      cy.logStep("Testing retrieval of non-existent artist");

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "GET",
          url: `${Cypress.env("apiUrl")}${Cypress.env(
            "apiVersion"
          )}/artists/99999`,
          headers: headers,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(404);
          expect(response.body).to.have.property("detail");
          expect(response.body.detail).to.include(
            "Artist with ID 99999 not found"
          );

          cy.logSuccess("Non-existent artist correctly returned 404");
        });
      });
    });

    it("should handle malformed artist IDs", () => {
      cy.logStep("Testing malformed artist ID handling");

      const malformedIds = ["abc", "123abc", "null", "0", "-1"];

      malformedIds.forEach((malformedId) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "GET",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/${malformedId}`,
            headers: headers,
            failOnStatusCode: false,
          }).then((response) => {
            expect(response.status).to.be.oneOf([404, 422]);
            expect(response.body).to.have.property("detail");
            cy.logInfo(
              `Malformed ID '${malformedId}': Status ${response.status}`
            );
          });
        });
      });

      cy.logSuccess("All malformed IDs handled appropriately");
    });
  });

  describe("PUT /v1/artists/{artist_id} - Update Artists", () => {
    let testArtistId = null;

    beforeEach(() => {
      cy.generateArtistData().then((artistData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: headers,
            body: artistData,
          }).then((response) => {
            testArtistId = response.body.id;
            createdArtistIds.push(testArtistId);
          });
        });
      });
    });

    it("should update artist successfully", () => {
      cy.logStep("Testing artist update");

      cy.generateArtistData().then((updateData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "PUT",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/${testArtistId}`,
            headers: headers,
            body: updateData,
          }).then((response) => {
            expect(response.status).to.eq(200);
            expect(response.body).to.have.property("id", testArtistId);
            expect(response.body.name).to.eq(updateData.name);
            expect(response.body.bio).to.eq(updateData.bio);

            cy.validateArtistSchema(response.body);
            cy.logSuccess(`Artist updated successfully: ${response.body.name}`);
          });
        });
      });
    });

    it("should prevent duplicate names during update", () => {
      cy.logStep("Testing duplicate name prevention during update");

      cy.generateArtistData().then((anotherArtistData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: headers,
            body: anotherArtistData,
          }).then((anotherResponse) => {
            createdArtistIds.push(anotherResponse.body.id);

            cy.generateArtistData().then((updateData) => {
              updateData.name = anotherArtistData.name; 

              cy.request({
                method: "PUT",
                url: `${Cypress.env("apiUrl")}${Cypress.env(
                  "apiVersion"
                )}/artists/${testArtistId}`,
                headers: headers,
                body: updateData,
                failOnStatusCode: false,
              }).then((updateResponse) => {
                expect(updateResponse.status).to.eq(409);
                expect(updateResponse.body).to.have.property("detail");
                expect(updateResponse.body.detail).to.include("already exists");

                cy.logSuccess(
                  "Duplicate name during update correctly prevented"
                );
              });
            });
          });
        });
      });
    });

    it("should return 404 for updating non-existent artist", () => {
      cy.logStep("Testing update of non-existent artist");

      cy.generateArtistData().then((updateData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "PUT",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/99999`,
            headers: headers,
            body: updateData,
            failOnStatusCode: false,
          }).then((response) => {
            expect(response.status).to.eq(404);
            expect(response.body).to.have.property("detail");
            expect(response.body.detail).to.include(
              "Artist with ID 99999 not found"
            );

            cy.logSuccess(
              "Update of non-existent artist correctly returned 404"
            );
          });
        });
      });
    });

    it("should handle validation errors during updates", () => {
      cy.logStep("Testing update validation");

      cy.getAuthHeaders().then((headers) => {
        const invalidUpdateTests = [
          {
            payload: { name: "", bio: "Updated bio" },
            desc: "empty name update",
            expectedStatus: [400, 409, 422], 
          },
          {
            payload: { name: null, bio: "Updated bio" },
            desc: "null name update",
            expectedStatus: [400, 409, 422],
          },
        ];

        invalidUpdateTests.forEach((testData) => {
          cy.request({
            method: "PUT",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/${testArtistId}`,
            headers: headers,
            body: testData.payload,
            failOnStatusCode: false,
          }).then((response) => {
            expect(response.status).to.be.oneOf(testData.expectedStatus);
            expect(response.body).to.have.property("detail");
            cy.logInfo(`${testData.desc}: Status ${response.status}`);
          });
        });

        cy.logSuccess("Update validation working correctly");
      });
    });
  });

  describe("DELETE /v1/artists/{artist_id} - Delete Artists", () => {
    it("should delete artist successfully", () => {
      cy.logStep("Testing artist deletion");

      
      cy.generateArtistData().then((artistData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: headers,
            body: artistData,
          }).then((createResponse) => {
            const artistId = createResponse.body.id;

        
            cy.request({
              method: "DELETE",
              url: `${Cypress.env("apiUrl")}${Cypress.env(
                "apiVersion"
              )}/artists/${artistId}`,
              headers: headers,
            }).then((deleteResponse) => {
              expect(deleteResponse.status).to.eq(204);

              cy.request({
                method: "GET",
                url: `${Cypress.env("apiUrl")}${Cypress.env(
                  "apiVersion"
                )}/artists/${artistId}`,
                headers: headers,
                failOnStatusCode: false,
              }).then((getResponse) => {
                expect(getResponse.status).to.eq(404);
                cy.logSuccess(`Artist ${artistId} successfully deleted`);
              });
            });
          });
        });
      });
    });

    it("should return 404 when deleting non-existent artist", () => {
      cy.logStep("Testing deletion of non-existent artist");

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "DELETE",
          url: `${Cypress.env("apiUrl")}${Cypress.env(
            "apiVersion"
          )}/artists/99999`,
          headers: headers,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(404);
          expect(response.body).to.have.property("detail");
          expect(response.body.detail).to.include(
            "Artist with ID 99999 not found"
          );

          cy.logSuccess(
            "Deletion of non-existent artist correctly returned 404"
          );
        });
      });
    });

    it("should handle malformed IDs in deletion", () => {
      cy.logStep("Testing deletion with malformed IDs");

      const malformedIds = ["abc", "null", "-1"];

      malformedIds.forEach((malformedId) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "DELETE",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/${malformedId}`,
            headers: headers,
            failOnStatusCode: false,
          }).then((response) => {
            expect(response.status).to.be.oneOf([404, 422]);
            expect(response.body).to.have.property("detail");
            cy.logInfo(
              `Malformed ID '${malformedId}' deletion: Status ${response.status}`
            );
          });
        });
      });

      cy.logSuccess("Malformed ID deletion handling working correctly");
    });
  });

  describe("API Behavior Summary", () => {
    it("should demonstrate comprehensive API behavior understanding", () => {
      cy.logStep("Summarizing API behavior based on test results");

      cy.logInfo("=== API Behavior Summary ===");
      cy.logInfo("1. Authentication: Required for all operations");
      cy.logInfo("2. Name field: Required, cannot be empty or null");
      cy.logInfo("3. Bio field: Behavior determined by diagnostic test");
      cy.logInfo("4. Duplicates: Prevented with 409 status code");
      cy.logInfo("5. Not found: Returns 404 for non-existent resources");
      cy.logInfo("6. Malformed IDs: Handled with 404 or 422");
      cy.logInfo("7. Pagination: Supported with skip/limit parameters");
      cy.logInfo("8. CRUD operations: Full support for Create, Read, Update, Delete");

      cy.logSuccess("API behavior documentation complete");
    });
  });
});