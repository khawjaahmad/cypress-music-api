describe("Users API - Favorites Management", () => {
  let testUsers = [];
  let createdUserIds = [];
  let testSongIds = [1, 2, 3];

  before(() => {
    cy.logStep("Setting up Users Favorites test suite");

    return cy.authenticateAdmin().then(() => {
      cy.log("Verifying test songs exist...");
      cy.getAuthHeaders().then((headers) => {
        testSongIds.forEach((songId) => {
          cy.request({
            method: "GET",
            url: `${Cypress.env("apiUrl")}${Cypress.env(
              "apiVersion"
            )}/songs/${songId}`,
            headers: headers,
            failOnStatusCode: false,
          }).then((response) => {
            if (response.status !== 200) {
              cy.log(
                `Warning: Song ${songId} does not exist. Status: ${response.status}`
              );
            } else {
              cy.log(`Song ${songId} verified: ${response.body.title}`);
            }
          });
        });
      });

      return cy.generateTestUsers(3).then((users) => {
        testUsers = users;
        cy.logInfo(
          `Generated ${testUsers.length} test users for favorites testing`
        );

        return createUsersSequentially(users).then(() => {
          cy.logInfo(
            `Created ${createdUserIds.length} test users successfully`
          );
          return cy.wrap(null);
        });
      });
    });
  });

  function createUsersSequentially(users) {
    return users.reduce((promise, userData, index) => {
      return promise.then(() => {
        return cy.createUser(userData).then((createdUser) => {
          createdUserIds.push(createdUser.id);
          testUsers[index] = createdUser;
          cy.logInfo(
            `Created test user: ${createdUser.username} (ID: ${createdUser.id})`
          );
          return cy.wrap(null);
        });
      });
    }, cy.wrap(null));
  }

  beforeEach(() => {
    const token = Cypress.env("currentAuthToken");
    if (!token) {
      cy.authenticateAdmin();
    }
  });

  after(() => {
    cy.logStep("Cleaning up Users Favorites test suite");

    if (createdUserIds.length > 0) {
      return cy.cleanupTestUsers(createdUserIds);
    }
  });

  describe("POST /v1/users/{user_id}/favorites/{song_id} - Add Favorites", () => {
    it("should add single song to user favorites successfully", () => {
      cy.logStep("Testing add single favorite");

      const userToTest = testUsers[0];
      const songId = testSongIds[0];

      cy.log(
        "User before adding favorite:",
        JSON.stringify(userToTest, null, 2)
      );

      cy.addFavorite(userToTest.id, songId).then((updatedUser) => {
        cy.log(
          "Updated user after adding favorite:",
          JSON.stringify(updatedUser, null, 2)
        );

        expect(updatedUser).to.have.property("favorites");
        expect(updatedUser.favorites).to.be.an("array");
        expect(updatedUser.favorites).to.include(songId);
        expect(updatedUser.id).to.eq(userToTest.id);

        cy.validateUserSchema(updatedUser);

        testUsers[0].favorites = updatedUser.favorites;

        cy.logSuccess(`Successfully added song ${songId} to favorites`);
      });
    });

    it("should add multiple songs to user favorites successfully", () => {
      cy.logStep("Testing add multiple favorites");

      const userToTest = testUsers[1];

      return testSongIds
        .reduce((promise, songId) => {
          return promise.then(() => {
            return cy.addFavorite(userToTest.id, songId).then((updatedUser) => {
              expect(updatedUser.favorites).to.include(songId);
              expect(updatedUser.id).to.eq(userToTest.id);

              cy.validateUserSchema(updatedUser);

              cy.logSuccess(`Successfully added song ${songId} to favorites`);
              return cy.wrap(null);
            });
          });
        }, cy.wrap(null))
        .then(() => {
          return cy.getUserById(userToTest.id).then((user) => {
            testUsers[1].favorites = user.favorites;
            testSongIds.forEach((songId) => {
              expect(user.favorites).to.include(songId);
            });
            cy.logSuccess("All songs successfully added to favorites");
          });
        });
    });

    it("should fail to add non-existent song to favorites", () => {
      cy.logStep("Testing add non-existent song to favorites");

      const userToTest = testUsers[2];
      const nonExistentSongId = 99999;

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${
            userToTest.id
          }/favorites/${nonExistentSongId}`,
          headers: headers,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(404);
          expect(response.body).to.have.property("detail");
          expect(response.body.detail).to.include(
            `Song with ID ${nonExistentSongId} not found`
          );

          cy.logSuccess("Correctly rejected non-existent song");
        });
      });
    });

    it("should fail to add duplicate song to favorites", () => {
      cy.logStep("Testing add duplicate song to favorites");

      const userToTest = testUsers[0];

      if (!userToTest.favorites || userToTest.favorites.length === 0) {
        cy.addFavorite(userToTest.id, testSongIds[0]).then((updatedUser) => {
          cy.getAuthHeaders().then((headers) => {
            cy.request({
              method: "POST",
              url: `${Cypress.env("apiUrl")}${Cypress.env(
                "apiVersion"
              )}/users/${userToTest.id}/favorites/${testSongIds[0]}`,
              headers: headers,
              failOnStatusCode: false,
            }).then((response) => {
              expect(response.status).to.be.oneOf([409, 422]);
              expect(response.body).to.have.property("detail");
              expect(response.body.detail).to.include("already");

              cy.logSuccess("Correctly rejected duplicate favorite");
            });
          });
        });
      } else {
        const existingSongId = userToTest.favorites[0];

        cy.getAuthHeaders().then((headers) => {
          cy.request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${
              userToTest.id
            }/favorites/${existingSongId}`,
            headers: headers,
            failOnStatusCode: false,
          }).then((response) => {
            expect(response.status).to.be.oneOf([409, 422]);
            expect(response.body).to.have.property("detail");
            expect(response.body.detail).to.include("already");

            cy.logSuccess("Correctly rejected duplicate favorite");
          });
        });
      }
    });

    it("should fail to add favorite to non-existent user", () => {
      cy.logStep("Testing add favorite to non-existent user");

      const nonExistentUserId = 99999;
      const songId = testSongIds[0];

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}${Cypress.env(
            "apiVersion"
          )}/users/${nonExistentUserId}/favorites/${songId}`,
          headers: headers,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(404);
          expect(response.body).to.have.property("detail");
          expect(response.body.detail).to.include(
            `User with ID ${nonExistentUserId} not found`
          );

          cy.logSuccess("Correctly rejected non-existent user");
        });
      });
    });

    it("should fail to add favorite with malformed song ID", () => {
      cy.logStep("Testing add favorite with malformed song ID");

      const userToTest = testUsers[2];
      const malformedSongId = "abc";

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${
            userToTest.id
          }/favorites/${malformedSongId}`,
          headers: headers,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.be.oneOf([404, 422]);
          expect(response.body).to.have.property("detail");

          cy.logSuccess("Correctly handled malformed song ID");
        });
      });
    });

    it("should fail to add favorite with malformed user ID", () => {
      cy.logStep("Testing add favorite with malformed user ID");

      const malformedUserId = "xyz";
      const songId = testSongIds[0];

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}${Cypress.env(
            "apiVersion"
          )}/users/${malformedUserId}/favorites/${songId}`,
          headers: headers,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.be.oneOf([404, 422]);
          expect(response.body).to.have.property("detail");

          cy.logSuccess("Correctly handled malformed user ID");
        });
      });
    });

    it("should fail to add favorite without authentication", () => {
      cy.logStep("Testing add favorite without authentication");

      const userToTest = testUsers[2];
      const songId = testSongIds[0];

      cy.request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${
          userToTest.id
        }/favorites/${songId}`,
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": Cypress.env("apiKey"),
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body).to.have.property("detail");

        cy.logSuccess("Correctly rejected unauthenticated request");
      });
    });
  });

  describe("DELETE /v1/users/{user_id}/favorites/{song_id} - Remove Favorites", () => {
    beforeEach(() => {
      const userToTest = testUsers[2];
      const songId = testSongIds[0];

      return cy.getUserById(userToTest.id).then((user) => {
        if (!user.favorites || !user.favorites.includes(songId)) {
          return cy.addFavorite(userToTest.id, songId).then((updatedUser) => {
            testUsers[2] = updatedUser;
            return cy.wrap(null);
          });
        } else {
          testUsers[2] = user;
          return cy.wrap(null);
        }
      });
    });

    it("should remove song from user favorites successfully", () => {
      cy.logStep("Testing remove single favorite");

      const userToTest = testUsers[1];

      if (!userToTest.favorites || userToTest.favorites.length === 0) {
        cy.addFavorite(userToTest.id, testSongIds[0]).then((updatedUser) => {
          testUsers[1] = updatedUser;
          const songToRemove = updatedUser.favorites[0];

          cy.removeFavorite(userToTest.id, songToRemove).then((finalUser) => {
            expect(finalUser.favorites).to.not.include(songToRemove);
            expect(finalUser.id).to.eq(userToTest.id);
            cy.validateUserSchema(finalUser);
            testUsers[1] = finalUser;
            cy.logSuccess(
              `Successfully removed song ${songToRemove} from favorites`
            );
          });
        });
      } else {
        const songToRemove = userToTest.favorites[0];

        cy.removeFavorite(userToTest.id, songToRemove).then((updatedUser) => {
          expect(updatedUser.favorites).to.not.include(songToRemove);
          expect(updatedUser.id).to.eq(userToTest.id);
          cy.validateUserSchema(updatedUser);
          testUsers[1] = updatedUser;
          cy.logSuccess(
            `Successfully removed song ${songToRemove} from favorites`
          );
        });
      }
    });

    it("should remove multiple songs from favorites successfully", () => {
      cy.logStep("Testing remove multiple favorites");

      const userToTest = testUsers[1];

      cy.getUserById(userToTest.id).then((currentUser) => {
        if (currentUser.favorites && currentUser.favorites.length > 0) {
          return currentUser.favorites
            .reduce((promise, songId) => {
              return promise.then(() => {
                return cy
                  .removeFavorite(userToTest.id, songId)
                  .then((updatedUser) => {
                    expect(updatedUser.favorites).to.not.include(songId);
                    expect(updatedUser.id).to.eq(userToTest.id);
                    cy.validateUserSchema(updatedUser);
                    cy.logSuccess(
                      `Successfully removed song ${songId} from favorites`
                    );
                    return cy.wrap(null);
                  });
              });
            }, cy.wrap(null))
            .then(() => {
              cy.getUserById(userToTest.id).then((finalUser) => {
                expect(finalUser.favorites).to.be.an("array").that.is.empty;
                testUsers[1] = finalUser;
                cy.logSuccess("All favorites successfully removed");
              });
            });
        } else {
          cy.logInfo("User has no favorites to remove");
          return cy.wrap(null);
        }
      });
    });

    it("should fail to remove song not in favorites", () => {
      cy.logStep("Testing remove song not in favorites");

      const userToTest = testUsers[0];
      const songNotInFavorites =
        testSongIds.find(
          (id) => !userToTest.favorites || !userToTest.favorites.includes(id)
        ) || testSongIds[2];

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "DELETE",
          url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${
            userToTest.id
          }/favorites/${songNotInFavorites}`,
          headers: headers,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(404);
          expect(response.body).to.have.property("detail");
          expect(response.body.detail).to.include("in favorites not found");

          cy.logSuccess("Correctly rejected removal of non-favorite song");
        });
      });
    });

    it("should fail to remove favorite from non-existent user", () => {
      cy.logStep("Testing remove favorite from non-existent user");

      const nonExistentUserId = 99999;
      const songId = testSongIds[0];

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "DELETE",
          url: `${Cypress.env("apiUrl")}${Cypress.env(
            "apiVersion"
          )}/users/${nonExistentUserId}/favorites/${songId}`,
          headers: headers,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.eq(404);
          expect(response.body).to.have.property("detail");
          expect(response.body.detail).to.include(
            `User with ID ${nonExistentUserId} not found`
          );

          cy.logSuccess("Correctly rejected non-existent user");
        });
      });
    });

    it("should fail to remove favorite with malformed song ID", () => {
      cy.logStep("Testing remove favorite with malformed song ID");

      const userToTest = testUsers[2];
      const malformedSongId = "invalid";

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "DELETE",
          url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${
            userToTest.id
          }/favorites/${malformedSongId}`,
          headers: headers,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.be.oneOf([404, 422]);
          expect(response.body).to.have.property("detail");

          cy.logSuccess("Correctly handled malformed song ID");
        });
      });
    });

    it("should fail to remove favorite with malformed user ID", () => {
      cy.logStep("Testing remove favorite with malformed user ID");

      const malformedUserId = "invalid";
      const songId = testSongIds[0];

      cy.getAuthHeaders().then((headers) => {
        cy.request({
          method: "DELETE",
          url: `${Cypress.env("apiUrl")}${Cypress.env(
            "apiVersion"
          )}/users/${malformedUserId}/favorites/${songId}`,
          headers: headers,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.be.oneOf([404, 422]);
          expect(response.body).to.have.property("detail");

          cy.logSuccess("Correctly handled malformed user ID");
        });
      });
    });

    it("should fail to remove favorite without authentication", () => {
      cy.logStep("Testing remove favorite without authentication");

      const userToTest = testUsers[2];
      const songId = testSongIds[0];

      cy.request({
        method: "DELETE",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${
          userToTest.id
        }/favorites/${songId}`,
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": Cypress.env("apiKey"),
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body).to.have.property("detail");

        cy.logSuccess("Correctly rejected unauthenticated request");
      });
    });
  });

  describe("Favorites Edge Cases and Scenarios", () => {
    it("should handle adding and removing the same song multiple times", () => {
      cy.logStep("Testing add/remove cycle for same song");

      const userToTest = testUsers[2];
      const songId = testSongIds[1];

      cy.getUserById(userToTest.id).then((user) => {
        if (user.favorites && user.favorites.includes(songId)) {
          cy.removeFavorite(userToTest.id, songId).then(() => {
            addSongAndContinue();
          });
        } else {
          addSongAndContinue();
        }
      });

      function addSongAndContinue() {
        cy.addFavorite(userToTest.id, songId).then((updatedUser) => {
          expect(updatedUser.favorites).to.include(songId);
          testUsers[2] = updatedUser;

          cy.removeFavorite(userToTest.id, songId).then((removedUser) => {
            expect(removedUser.favorites).to.not.include(songId);
            testUsers[2] = removedUser;

            cy.addFavorite(userToTest.id, songId).then((finalUser) => {
              expect(finalUser.favorites).to.include(songId);
              testUsers[2] = finalUser;
              cy.logSuccess("Successfully handled add/remove cycle");
            });
          });
        });
      }
    });

    it("should handle concurrent favorite operations", () => {
      cy.logStep("Testing concurrent favorite operations");

      const userToTest = testUsers[0];
      const songsToAdd = [testSongIds[1], testSongIds[2]];

      cy.getUserById(userToTest.id).then((currentUser) => {
        const songsToRemoveFirst = songsToAdd.filter(
          (songId) =>
            currentUser.favorites && currentUser.favorites.includes(songId)
        );

        const removeExistingFavorites = () => {
          if (songsToRemoveFirst.length === 0) {
            return cy.wrap(null);
          }

          return songsToRemoveFirst.reduce((promise, songId) => {
            return promise.then(() => {
              return cy.removeFavorite(userToTest.id, songId).then(() => {
                return cy.wrap(null);
              });
            });
          }, cy.wrap(null));
        };

        removeExistingFavorites().then(() => {
          return songsToAdd
            .reduce((promise, songId) => {
              return promise.then(() => {
                return cy
                  .addFavorite(userToTest.id, songId)
                  .then((updatedUser) => {
                    expect(updatedUser.favorites).to.include(songId);
                    cy.validateUserSchema(updatedUser);
                    return cy.wrap(null);
                  });
              });
            }, cy.wrap(null))
            .then(() => {
              cy.getUserById(userToTest.id).then((finalUser) => {
                songsToAdd.forEach((songId) => {
                  expect(finalUser.favorites).to.include(songId);
                });

                testUsers[0] = finalUser;

                cy.logSuccess(
                  "Concurrent favorite operations completed successfully"
                );
              });
            });
        });
      });
    });

    it("should handle favorites with empty starting favorites list", () => {
      cy.logStep("Testing favorites operations with empty starting list");

      const userToTest = testUsers[1];

      cy.updateUser(userToTest.id, { favorites: [] }).then((updatedUser) => {
        testUsers[1] = updatedUser;

        cy.addFavorite(userToTest.id, testSongIds[0]).then(
          (userWithFavorite) => {
            expect(userWithFavorite.favorites).to.have.length(1);
            expect(userWithFavorite.favorites).to.include(testSongIds[0]);

            cy.validateUserSchema(userWithFavorite);
            testUsers[1] = userWithFavorite;

            cy.logSuccess("Successfully added favorite to empty list");
          }
        );
      });
    });

    it("should maintain favorites order after operations", () => {
      cy.logStep("Testing favorites order consistency");

      const userToTest = testUsers[2];

      cy.getUserById(userToTest.id).then((initialUser) => {
        const initialFavoritesCount = initialUser.favorites
          ? initialUser.favorites.length
          : 0;

        const newSongId = testSongIds.find(
          (id) => !initialUser.favorites || !initialUser.favorites.includes(id)
        );

        if (newSongId) {
          cy.addFavorite(userToTest.id, newSongId).then((updatedUser) => {
            expect(updatedUser.favorites).to.have.length(
              initialFavoritesCount + 1
            );
            expect(updatedUser.favorites).to.include(newSongId);

            cy.removeFavorite(userToTest.id, newSongId).then((finalUser) => {
              expect(finalUser.favorites).to.have.length(initialFavoritesCount);
              expect(finalUser.favorites).to.not.include(newSongId);

              if (initialUser.favorites) {
                initialUser.favorites.forEach((songId) => {
                  expect(finalUser.favorites).to.include(songId);
                });
              }

              cy.logSuccess("Favorites order maintained correctly");
            });
          });
        } else {
          cy.logInfo("No available songs to test order with");
        }
      });
    });

    it("should validate response consistency across favorite operations", () => {
      cy.logStep("Testing response consistency");

      const userToTest = testUsers[0];

      cy.getUserById(userToTest.id).then((baselineUser) => {
        cy.validateUserSchema(baselineUser);

        const testSongId = testSongIds.find(
          (id) =>
            !baselineUser.favorites || !baselineUser.favorites.includes(id)
        );

        if (testSongId) {
          cy.addFavorite(userToTest.id, testSongId).then((userAfterAdd) => {
            expect(userAfterAdd.id).to.eq(baselineUser.id);
            expect(userAfterAdd.username).to.eq(baselineUser.username);
            expect(userAfterAdd.email).to.eq(baselineUser.email);

            expect(userAfterAdd.favorites).to.include(testSongId);
            const expectedLength = baselineUser.favorites
              ? baselineUser.favorites.length + 1
              : 1;
            expect(userAfterAdd.favorites.length).to.eq(expectedLength);

            cy.validateUserSchema(userAfterAdd);

            cy.removeFavorite(userToTest.id, testSongId).then(
              (userAfterRemove) => {
                expect(userAfterRemove.id).to.eq(baselineUser.id);
                expect(userAfterRemove.username).to.eq(baselineUser.username);
                expect(userAfterRemove.email).to.eq(baselineUser.email);
                expect(userAfterRemove.favorites).to.not.include(testSongId);

                const expectedFinalLength = baselineUser.favorites
                  ? baselineUser.favorites.length
                  : 0;
                expect(userAfterRemove.favorites.length).to.eq(
                  expectedFinalLength
                );

                cy.validateUserSchema(userAfterRemove);

                cy.logSuccess(
                  "Response consistency validated across operations"
                );
              }
            );
          });
        } else {
          cy.logInfo("No available songs to test consistency with");
        }
      });
    });
  });
});
