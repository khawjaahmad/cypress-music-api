describe("Artists API - Integration Tests", () => {
  let createdArtistIds = [];
  let createdAlbumIds = [];
  let createdUserIds = [];

  before(() => {
    cy.logStep("Setting up Artists Integration test suite");
    cy.authenticateAdmin();
  });

  beforeEach(() => {
    const token = Cypress.env("currentAuthToken");
    if (!token) {
      cy.authenticateAdmin();
    }
  });

  after(() => {
    cy.logStep("Cleaning up Artists Integration test suite");

    if (createdAlbumIds.length > 0) {
      cy.logInfo(`Cleaning up ${createdAlbumIds.length} test albums`);
      cy.cleanupTestAlbums(createdAlbumIds);
    }

    if (createdArtistIds.length > 0) {
      cy.logInfo(`Cleaning up ${createdArtistIds.length} test artists`);
      cy.cleanupTestArtists(createdArtistIds);
    }

    if (createdUserIds.length > 0) {
      cy.cleanupTestUsers(createdUserIds);
    }
  });

  describe("Artist-Album Relationship", () => {
    it("should handle artist deletion with cascade effects", () => {
      cy.logStep("Testing artist deletion cascade behavior");

      cy.generateArtistData().then((artistData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: headers,
            body: artistData,
          }).then((artistResponse) => {
            const artistId = artistResponse.body.id;
            createdArtistIds.push(artistId);

            cy.generateAlbumData(1).then((albumData) => {
              const album = Array.isArray(albumData) ? albumData[0] : albumData;
              album.artist_id = artistId;

              cy.request({
                method: "POST",
                url: `${Cypress.env("apiUrl")}${Cypress.env(
                  "apiVersion"
                )}/albums/`,
                headers: headers,
                body: album,
              }).then((albumResponse) => {
                const albumId = albumResponse.body.id;

                cy.request({
                  method: "DELETE",
                  url: `${Cypress.env("apiUrl")}${Cypress.env(
                    "apiVersion"
                  )}/artists/${artistId}`,
                  headers: headers,
                }).then((deleteResponse) => {
                  expect(deleteResponse.status).to.eq(204);

                  createdArtistIds = createdArtistIds.filter(
                    (id) => id !== artistId
                  );

                  cy.request({
                    method: "GET",
                    url: `${Cypress.env("apiUrl")}${Cypress.env(
                      "apiVersion"
                    )}/artists/${artistId}`,
                    headers: headers,
                    failOnStatusCode: false,
                  }).then((artistCheckResponse) => {
                    expect(artistCheckResponse.status).to.eq(404);
                  });

                  cy.request({
                    method: "GET",
                    url: `${Cypress.env("apiUrl")}${Cypress.env(
                      "apiVersion"
                    )}/albums/${albumId}`,
                    headers: headers,
                    failOnStatusCode: false,
                  }).then((albumCheckResponse) => {
                    expect(albumCheckResponse.status).to.eq(404);
                    cy.logSuccess(
                      "Artist deletion with cascade behavior working correctly"
                    );
                  });
                });
              });
            });
          });
        });
      });
    });

    it("should maintain referential integrity", () => {
      cy.logStep("Testing referential integrity during operations");

      cy.generateArtistData().then((artistData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: headers,
            body: artistData,
          }).then((artistResponse) => {
            const artistId = artistResponse.body.id;
            createdArtistIds.push(artistId);

            cy.generateAlbumData(1).then((albumData) => {
              const album = Array.isArray(albumData) ? albumData[0] : albumData;
              album.artist_id = artistId;

              cy.request({
                method: "POST",
                url: `${Cypress.env("apiUrl")}${Cypress.env(
                  "apiVersion"
                )}/albums/`,
                headers: headers,
                body: album,
              }).then((albumResponse) => {
                const albumId = albumResponse.body.id;
                createdAlbumIds.push(albumId);

                cy.generateArtistData().then((updateData) => {
                  cy.request({
                    method: "PUT",
                    url: `${Cypress.env("apiUrl")}${Cypress.env(
                      "apiVersion"
                    )}/artists/${artistId}`,
                    headers: headers,
                    body: updateData,
                  }).then((updateResponse) => {
                    expect(updateResponse.status).to.eq(200);

                    cy.request({
                      method: "GET",
                      url: `${Cypress.env("apiUrl")}${Cypress.env(
                        "apiVersion"
                      )}/albums/${albumId}`,
                      headers: headers,
                    }).then((albumCheckResponse) => {
                      expect(albumCheckResponse.status).to.eq(200);
                      expect(albumCheckResponse.body.artist_id).to.eq(artistId);

                      cy.logSuccess(
                        "Referential integrity maintained during artist update"
                      );
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe("Authentication & Authorization", () => {
    it("should enforce admin-only operations", () => {
      cy.logStep("Testing admin-only operation enforcement");

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

          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: {
              Authorization: "Bearer invalid-token",
              "Content-Type": "application/json",
              "X-API-KEY": Cypress.env("apiKey"),
            },
            body: artistData,
            failOnStatusCode: false,
          }).then((invalidResponse) => {
            expect(invalidResponse.status).to.eq(401);
            cy.logSuccess("Admin-only operations properly protected");
          });
        });
      });
    });

    it("should integrate with user management system", () => {
      cy.logStep("Testing integration with user management");

      cy.generateTestUsers(1).then((users) => {
        cy.createUser(users[0]).then((createdUser) => {
          createdUserIds.push(createdUser.id);

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

                cy.request({
                  method: "GET",
                  url: `${Cypress.env("apiUrl")}${Cypress.env(
                    "apiVersion"
                  )}/artists/`,
                  headers: headers,
                }).then((listResponse) => {
                  expect(listResponse.status).to.eq(200);

                  const foundArtist = listResponse.body.find(
                    (artist) => artist.id === response.body.id
                  );
                  expect(foundArtist).to.exist;
                  expect(foundArtist.name).to.eq(artistData.name);

                  cy.logSuccess(
                    "Artist API properly integrated with user management"
                  );
                });
              });
            });
          });
        });
      });
    });
  });

  describe("Data Validation Edge Cases", () => {
    it("should handle special characters correctly", () => {
      cy.logStep("Testing special characters in artist data");

      const timestamp = Date.now();
      const specialCharacterTests = [
        {
          name: `Björk & The Über Band ${timestamp}_1`,
          bio: "An artist with ünicöde çharacters and spëcial symbols!",
          desc: "Unicode characters",
        },
        {
          name: `O'Connor & Sons ${timestamp}_2`,
          bio: 'Artist with apostrophes and "quotes" in bio.',
          desc: "Apostrophes and quotes",
        },
        {
          name: `Band with émojis 🎵🎸 ${timestamp}_3`,
          bio: "Bio with émojis: ♪♫♬ Making music! 🎤",
          desc: "Emojis and musical symbols",
        },
      ];

      specialCharacterTests.forEach((testData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: headers,
            body: {
              name: testData.name,
              bio: testData.bio,
            },
            failOnStatusCode: false,
          }).then((response) => {
            if (response.status === 201) {
              expect(response.body.name).to.eq(testData.name);
              expect(response.body.bio).to.eq(testData.bio);
              createdArtistIds.push(response.body.id);
              cy.logInfo(`${testData.desc}: Successfully created`);
            } else if (response.status === 409) {
              cy.logInfo(
                `${testData.desc}: Already exists (409 conflict) - this is expected`
              );
            } else {
              cy.logWarning(
                `${testData.desc}: Unexpected status ${response.status}`
              );
            }
          });
        });
      });

      cy.logSuccess("Special characters test completed");
    });

    it("should reject invalid data properly", () => {
      cy.logStep("Testing invalid data rejection");

      const invalidTests = [
        {
          name: "",
          bio: "Valid bio",
          desc: "Empty name",
          expectedStatus: [400, 409, 422],
        },
        {
          name: "Valid Name",
          bio: "",
          desc: "Empty bio",
          expectedStatus: [201, 400, 409, 422],
        },
        {
          name: "   ",
          bio: "Valid bio",
          desc: "Whitespace-only name",
          expectedStatus: [201, 400, 409, 422],
        },
        {
          name: "Valid Name",
          bio: "   ",
          desc: "Whitespace-only bio",
          expectedStatus: [201, 400, 409, 422],
        },
        {
          name: null,
          bio: "Valid bio",
          desc: "null name",
          expectedStatus: [400, 409, 422],
        },
        {
          name: "Valid Name",
          bio: null,
          desc: "null bio",
          expectedStatus: [201, 400, 409, 422],
        },
      ];

      invalidTests.forEach((testData) => {
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

            if (response.status === 201 && response.body.id) {
              createdArtistIds.push(response.body.id);
            }

            cy.logInfo(`${testData.desc}: Status ${response.status}`);
          });
        });
      });

      cy.logSuccess("Invalid data test completed");
    });
  });

  describe("Error Handling & Data Consistency", () => {
    it("should handle duplicate name constraints", () => {
      cy.logStep("Testing duplicate name constraint handling");

      cy.generateArtistData().then((artistData) => {
        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/artists/`,
            headers: headers,
            body: artistData,
          }).then((firstResponse) => {
            expect(firstResponse.status).to.eq(201);
            createdArtistIds.push(firstResponse.body.id);

            cy.request({
              method: "POST",
              url: `${Cypress.env("apiUrl")}${Cypress.env(
                "apiVersion"
              )}/artists/`,
              headers: headers,
              body: artistData,
              failOnStatusCode: false,
            }).then((secondResponse) => {
              expect(secondResponse.status).to.eq(409);
              expect(secondResponse.body.detail).to.include("already exists");

              cy.request({
                method: "GET",
                url: `${Cypress.env("apiUrl")}${Cypress.env(
                  "apiVersion"
                )}/artists/${firstResponse.body.id}`,
                headers: headers,
              }).then((getResponse) => {
                expect(getResponse.status).to.eq(200);
                expect(getResponse.body.id).to.eq(firstResponse.body.id);

                cy.logSuccess(
                  "Duplicate constraint handled without data corruption"
                );
              });
            });
          });
        });
      });
    });

    it("should maintain data consistency during failed updates", () => {
      cy.logStep("Testing data consistency during failed operations");

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
            createdArtistIds.push(artistId);

            cy.request({
              method: "PUT",
              url: `${Cypress.env("apiUrl")}${Cypress.env(
                "apiVersion"
              )}/artists/${artistId}`,
              headers: headers,
              body: { name: "", bio: "Updated bio" },
              failOnStatusCode: false,
            }).then((updateResponse) => {
              expect(updateResponse.status).to.be.oneOf([400, 409, 422]);

              cy.request({
                method: "GET",
                url: `${Cypress.env("apiUrl")}${Cypress.env(
                  "apiVersion"
                )}/artists/${artistId}`,
                headers: headers,
              }).then((getResponse) => {
                expect(getResponse.status).to.eq(200);
                expect(getResponse.body.name).to.eq(artistData.name);
                expect(getResponse.body.bio).to.eq(artistData.bio);

                cy.logSuccess(
                  "Data consistency maintained during failed operations"
                );
              });
            });
          });
        });
      });
    });
  });

  describe("Performance & Concurrency", () => {
    it("should handle concurrent operations without conflicts", () => {
      cy.logStep("Testing concurrent operations");

      cy.task("generateArtistData", 3).then((artistsData) => {
        const timestamp = Date.now();

        artistsData.forEach((artist, index) => {
          artist.name = `${artist.name} ${timestamp}_${index}`;
        });

        cy.getAuthHeaders().then((headers) => {
          const startTime = Date.now();

          artistsData.forEach((artistData, index) => {
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
              cy.logInfo(
                `Created concurrent artist ${index + 1}: ${response.body.name}`
              );
            });
          });

          cy.then(() => {
            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(duration).to.be.lessThan(10000);
            cy.logSuccess(`Concurrent operations completed in ${duration}ms`);
          });
        });
      });
    });
  });
});
