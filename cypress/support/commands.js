// ==================== AUTHENTICATION COMMANDS ====================

Cypress.Commands.add("authenticateAdmin", () => {
  cy.logStep("Authenticating admin user");

  return cy
    .request({
      method: "POST",
      url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/auth/token`,
      form: true,
      body: {
        username: Cypress.env("adminUsername"),
        password: Cypress.env("adminPassword"),
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-API-KEY": Cypress.env("apiKey"),
      },
    })
    .then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("access_token");
      expect(response.body).to.have.property("token_type", "bearer");

      Cypress.env("currentAuthToken", response.body.access_token);
      cy.wrap(response.body.access_token).as("authToken");
      cy.logSuccess("Admin authentication successful");
    });
});

Cypress.Commands.add("getAuthHeaders", () => {
  const token = Cypress.env("currentAuthToken");
  if (token) {
    return cy.wrap({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-API-KEY": Cypress.env("apiKey"),
    });
  } else {
    return cy.get("@authToken").then((token) => {
      return cy.wrap({
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-API-KEY": Cypress.env("apiKey"),
      });
    });
  }
});

// ==================== USER MANAGEMENT COMMANDS ====================

Cypress.Commands.add("createUser", (userData) => {
  cy.logStep(`Creating user: ${userData.username}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/`,
        headers: headers,
        body: userData,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 201) {
          expect(response.body).to.have.property("id");
          expect(response.body.username).to.eq(userData.username);
          expect(response.body.email).to.eq(userData.email);

          cy.logSuccess(`User created with ID: ${response.body.id}`);
          return cy.wrap(response.body);
        } else if (response.status === 409) {
          cy.logInfo(
            `User ${userData.username} already exists. Attempting to retrieve existing user`
          );

          return cy
            .request({
              method: "GET",
              url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/`,
              headers: headers,
              qs: { limit: 100 },
            })
            .then((usersResponse) => {
              const existingUser = usersResponse.body.find(
                (u) => u.username === userData.username
              );

              if (existingUser) {
                cy.logSuccess(`Found existing user with ID: ${existingUser.id}`);
                return cy.wrap(existingUser);
              } else {
                const uniqueUsername = `${userData.username}_${Date.now()}`;
                const uniqueEmail = `unique_${Date.now()}@example.com`;

                cy.logInfo(`Creating user with unique name: ${uniqueUsername}`);
                return cy.createUser({
                  ...userData,
                  username: uniqueUsername,
                  email: uniqueEmail,
                });
              }
            });
        } else {
          throw new Error(
            `Failed to create user: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

Cypress.Commands.add("listUsers", (skip = 0, limit = 100) => {
  cy.logStep(`Listing users (skip: ${skip}, limit: ${limit})`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/`,
        headers: headers,
        qs: { skip, limit },
      })
      .then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.be.an("array");

        cy.logSuccess(`Retrieved ${response.body.length} users`);
        return cy.wrap(response.body);
      });
  });
});

Cypress.Commands.add("getUserById", (userId) => {
  cy.logStep(`Getting user by ID: ${userId}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${userId}`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 200) {
          expect(response.body).to.have.property("id", userId);
          cy.logSuccess(`Retrieved user: ${response.body.username}`);
          return cy.wrap(response.body);
        } else if (response.status === 404) {
          cy.logInfo(`User with ID ${userId} not found`);
          return cy.wrap(null);
        } else {
          throw new Error(
            `Failed to get user: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

Cypress.Commands.add("updateUser", (userId, updateData) => {
  cy.logStep(`Updating user ID: ${userId}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "PUT",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${userId}`,
        headers: headers,
        body: updateData,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 200) {
          expect(response.body).to.have.property("id", userId);
          cy.logSuccess(`User updated successfully`);
          return cy.wrap(response.body);
        } else if (response.status === 404) {
          cy.logInfo(`User with ID ${userId} not found`);
          return cy.wrap(null);
        } else if (response.status === 409) {
          throw new Error(`Update conflict: ${response.body.detail}`);
        } else {
          throw new Error(
            `Failed to update user: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

Cypress.Commands.add("deleteUser", (userId) => {
  cy.logStep(`Deleting user ID: ${userId}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "DELETE",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${userId}`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 204) {
          cy.logSuccess(`User ${userId} deleted successfully`);
        } else {
          cy.logInfo(
            `Note: Could not delete user ${userId}, status: ${response.status}`
          );
        }
        return cy.wrap(response);
      });
  });
});

Cypress.Commands.add("addFavorite", (userId, songId) => {
  cy.logStep(`Adding song ${songId} to user ${userId} favorites`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${userId}/favorites/${songId}`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((response) => {
        cy.log("Add favorite response:", JSON.stringify(response.body, null, 2));

        if (response.status === 409) {
          cy.log(`Song ${songId} already in favorites, fetching current user state`);
          return cy
            .request({
              method: "GET",
              url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${userId}`,
              headers: headers,
            })
            .then((userResponse) => {
              return cy.wrap(userResponse.body);
            });
        } else if (response.status === 200) {
          return cy.wrap(response.body);
        } else if (response.status === 404) {
          throw new Error(`Failed to add favorite: ${response.body.detail}`);
        } else {
          throw new Error(
            `Failed to add favorite: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

Cypress.Commands.add("removeFavorite", (userId, songId) => {
  cy.logStep(`Removing song ${songId} from user ${userId} favorites`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "DELETE",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${userId}/favorites/${songId}`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((response) => {
        cy.log("Remove favorite response:", JSON.stringify(response.body, null, 2));

        if (response.status === 404) {
          cy.log(`Song ${songId} not in favorites, fetching current user state`);
          return cy
            .request({
              method: "GET",
              url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${userId}`,
              headers: headers,
            })
            .then((userResponse) => {
              return cy.wrap(userResponse.body);
            });
        } else if (response.status === 200) {
          return cy.wrap(response.body);
        } else {
          throw new Error(
            `Failed to remove favorite: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

// ==================== ARTIST MANAGEMENT COMMANDS ====================

Cypress.Commands.add("createArtist", (artistData) => {
  cy.logStep(`Creating artist: ${artistData.name}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/`,
        headers: headers,
        body: artistData,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 201) {
          expect(response.body).to.have.property("id");
          expect(response.body.name).to.eq(artistData.name);
          expect(response.body.bio).to.eq(artistData.bio);

          cy.logSuccess(`Artist created with ID: ${response.body.id}`);
          return cy.wrap(response.body);
        } else if (response.status === 409) {
          cy.logInfo(`Artist ${artistData.name} already exists`);
          throw new Error(`Artist with name '${artistData.name}' already exists`);
        } else {
          throw new Error(
            `Failed to create artist: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

Cypress.Commands.add("listArtists", (skip = 0, limit = 100) => {
  cy.logStep(`Listing artists (skip: ${skip}, limit: ${limit})`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/`,
        headers: headers,
        qs: { skip, limit },
      })
      .then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.be.an("array");

        cy.logSuccess(`Retrieved ${response.body.length} artists`);
        return cy.wrap(response.body);
      });
  });
});

Cypress.Commands.add("getArtistById", (artistId) => {
  cy.logStep(`Getting artist by ID: ${artistId}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/${artistId}`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 200) {
          expect(response.body).to.have.property("id", artistId);
          cy.logSuccess(`Retrieved artist: ${response.body.name}`);
          return cy.wrap(response.body);
        } else if (response.status === 404) {
          cy.logInfo(`Artist with ID ${artistId} not found`);
          return cy.wrap(null);
        } else {
          throw new Error(
            `Failed to get artist: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

Cypress.Commands.add("updateArtist", (artistId, updateData) => {
  cy.logStep(`Updating artist ID: ${artistId}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "PUT",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/${artistId}`,
        headers: headers,
        body: updateData,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 200) {
          expect(response.body).to.have.property("id", artistId);
          cy.logSuccess(`Artist updated successfully`);
          return cy.wrap(response.body);
        } else if (response.status === 404) {
          cy.logInfo(`Artist with ID ${artistId} not found`);
          return cy.wrap(null);
        } else if (response.status === 409) {
          throw new Error(`Update conflict: ${response.body.detail}`);
        } else {
          throw new Error(
            `Failed to update artist: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

Cypress.Commands.add("deleteArtist", (artistId) => {
  cy.logStep(`Deleting artist ID: ${artistId}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "DELETE",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/${artistId}`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 204) {
          cy.logSuccess(`Artist ${artistId} deleted successfully`);
        } else {
          cy.logInfo(
            `Note: Could not delete artist ${artistId}, status: ${response.status}`
          );
        }
        return cy.wrap(response);
      });
  });
});

// ==================== ALBUM MANAGEMENT COMMANDS ====================

Cypress.Commands.add("createAlbum", (albumData) => {
  cy.logStep(`Creating album: ${albumData.title}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/albums/`,
        headers: headers,
        body: albumData,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 201) {
          expect(response.body).to.have.property("id");
          expect(response.body.title).to.eq(albumData.title);

          cy.logSuccess(`Album created with ID: ${response.body.id}`);
          return cy.wrap(response.body);
        } else {
          throw new Error(
            `Failed to create album: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

Cypress.Commands.add("deleteAlbum", (albumId) => {
  cy.logStep(`Deleting album ID: ${albumId}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "DELETE",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/albums/${albumId}`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 204) {
          cy.logSuccess(`Album ${albumId} deleted successfully`);
        } else {
          cy.logInfo(
            `Note: Could not delete album ${albumId}, status: ${response.status}`
          );
        }
        return cy.wrap(response);
      });
  });
});

// ==================== SONG MANAGEMENT COMMANDS ====================

Cypress.Commands.add("createSong", (songData) => {
  cy.logStep(`Creating song: ${songData.title}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/songs/`,
        headers: headers,
        body: songData,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 201) {
          expect(response.body).to.have.property("id");
          expect(response.body.title).to.eq(songData.title);

          cy.logSuccess(`Song created with ID: ${response.body.id}`);
          return cy.wrap(response.body);
        } else {
          throw new Error(
            `Failed to create song: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

Cypress.Commands.add("listSongs", (skip = 0, limit = 100) => {
  cy.logStep(`Listing songs (skip: ${skip}, limit: ${limit})`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/songs/`,
        headers: headers,
        qs: { skip, limit },
      })
      .then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.be.an("array");

        cy.logSuccess(`Retrieved ${response.body.length} songs`);
        return cy.wrap(response.body);
      });
  });
});

Cypress.Commands.add("getSongById", (songId) => {
  cy.logStep(`Getting song by ID: ${songId}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/songs/${songId}`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 200) {
          expect(response.body).to.have.property("id", songId);
          cy.logSuccess(`Retrieved song: ${response.body.title}`);
          return cy.wrap(response.body);
        } else if (response.status === 404) {
          cy.logInfo(`Song with ID ${songId} not found`);
          return cy.wrap(null);
        } else {
          throw new Error(
            `Failed to get song: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

Cypress.Commands.add("deleteSong", (songId) => {
  cy.logStep(`Deleting song ID: ${songId}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "DELETE",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/songs/${songId}`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 204) {
          cy.logSuccess(`Song ${songId} deleted successfully`);
        } else {
          cy.logInfo(`Note: Could not delete song ${songId}, status: ${response.status}`);
        }
        return cy.wrap(response);
      });
  });
});

// ==================== PLAYLIST MANAGEMENT COMMANDS ====================

Cypress.Commands.add("createPlaylist", (playlistData) => {
  cy.logStep(`Creating playlist: ${playlistData.name}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/playlists/`,
        headers: headers,
        body: playlistData,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 201) {
          expect(response.body).to.have.property("id");
          expect(response.body.name).to.eq(playlistData.name);

          cy.logSuccess(`Playlist created with ID: ${response.body.id}`);
          return cy.wrap(response.body);
        } else {
          throw new Error(
            `Failed to create playlist: Status ${response.status}, ${JSON.stringify(
              response.body
            )}`
          );
        }
      });
  });
});

Cypress.Commands.add("listPlaylists", (skip = 0, limit = 100) => {
  cy.logStep(`Listing playlists (skip: ${skip}, limit: ${limit})`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/playlists/`,
        headers: headers,
        qs: { skip, limit },
      })
      .then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.be.an("array");

        cy.logSuccess(`Retrieved ${response.body.length} playlists`);
        return cy.wrap(response.body);
      });
  });
});

Cypress.Commands.add("deletePlaylist", (playlistId) => {
  cy.logStep(`Deleting playlist ID: ${playlistId}`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "DELETE",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/playlists/${playlistId}`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((response) => {
        if (response.status === 204) {
          cy.logSuccess(`Playlist ${playlistId} deleted successfully`);
        } else {
          cy.logInfo(
            `Note: Could not delete playlist ${playlistId}, status: ${response.status}`
          );
        }
        return cy.wrap(response);
      });
  });
});

// ==================== DATA GENERATION COMMANDS ====================

Cypress.Commands.add("generateTestUsers", (count = 4) => {
  return cy.task("generateTestUsers", count).then((users) => {
    cy.logInfo(`Generated ${count} test users`);
    return cy.wrap(users);
  });
});

Cypress.Commands.add("generateArtistData", (count = 1) => {
  return cy.task("generateArtistData", count).then((artistData) => {
    if (count === 1) {
      cy.logInfo(`Generated artist data: ${artistData.name}`);
    } else {
      cy.logInfo(`Generated ${count} artists`);
    }
    return cy.wrap(artistData);
  });
});

Cypress.Commands.add("generateAlbumData", (count = 1) => {
  return cy.task("generateAlbumData", count).then((albumData) => {
    if (count === 1) {
      cy.logInfo(`Generated album data: ${albumData.title}`);
    } else {
      cy.logInfo(`Generated ${count} albums`);
    }
    return cy.wrap(albumData);
  });
});

Cypress.Commands.add("generateSongData", (count = 1) => {
  return cy.task("generateSongData", count).then((songData) => {
    if (count === 1) {
      cy.logInfo(`Generated song data: ${songData.title}`);
    } else {
      cy.logInfo(`Generated ${count} songs`);
    }
    return cy.wrap(songData);
  });
});

Cypress.Commands.add("generatePlaylistData", (count = 1) => {
  return cy.task("generatePlaylistData", count).then((playlistData) => {
    if (count === 1) {
      cy.logInfo(`Generated playlist data: ${playlistData.name}`);
    } else {
      cy.logInfo(`Generated ${count} playlists`);
    }
    return cy.wrap(playlistData);
  });
});

Cypress.Commands.add("generateMusicTestData", () => {
  return cy.task("generateMusicTestData").then((data) => {
    cy.logInfo(`Generated complete music test data set`);
    return cy.wrap(data);
  });
});

Cypress.Commands.add("generateEdgeCaseData", (type) => {
  return cy.task("generateEdgeCaseData", type).then((data) => {
    cy.logInfo(`Generated edge case data for: ${type}`);
    return cy.wrap(data);
  });
});

Cypress.Commands.add("generateBulkTestData", (type, count = 10) => {
  return cy.task("generateBulkTestData", type, count).then((data) => {
    cy.logInfo(`Generated ${count} bulk test items for: ${type}`);
    return cy.wrap(data);
  });
});

// ==================== SCHEMA VALIDATION COMMANDS ====================

Cypress.Commands.add("validateUserSchema", (userData) => {
  expect(userData).to.have.property("id").that.is.a("number");
  expect(userData).to.have.property("username").that.is.a("string");
  expect(userData).to.have.property("email").that.is.a("string");
  expect(userData).to.have.property("favorites").that.is.an("array");
  cy.log("✅ User schema validation passed");
});

Cypress.Commands.add("validateArtistSchema", (artistData) => {
  expect(artistData).to.have.property("id").that.is.a("number");
  expect(artistData).to.have.property("name").that.is.a("string");
  expect(artistData).to.have.property("bio").that.is.a("string");
  cy.log("✅ Artist schema validation passed");
});

Cypress.Commands.add("validateAlbumSchema", (albumData) => {
  expect(albumData).to.have.property("id").that.is.a("number");
  expect(albumData).to.have.property("title").that.is.a("string");
  expect(albumData).to.have.property("release_year").that.is.a("number");
  expect(albumData).to.have.property("artist_id").that.is.a("number");
  cy.log("✅ Album schema validation passed");
});

Cypress.Commands.add("validateSongSchema", (songData) => {
  expect(songData).to.have.property("id").that.is.a("number");
  expect(songData).to.have.property("title").that.is.a("string");
  expect(songData).to.have.property("duration").that.is.a("number");
  expect(songData).to.have.property("genre").that.is.a("string");
  expect(songData).to.have.property("album_id").that.is.a("number");
  cy.log("✅ Song schema validation passed");
});

Cypress.Commands.add("validatePlaylistSchema", (playlistData) => {
  expect(playlistData).to.have.property("id").that.is.a("number");
  expect(playlistData).to.have.property("name").that.is.a("string");
  expect(playlistData).to.have.property("description").that.is.a("string");
  expect(playlistData).to.have.property("songs").that.is.an("array");
  cy.log("✅ Playlist schema validation passed");
});

Cypress.Commands.add("validateAuthTokenSchema", (tokenData) => {
  expect(tokenData).to.have.property("access_token").that.is.a("string");
  expect(tokenData).to.have.property("token_type", "bearer");
  expect(tokenData).to.have.property("user").that.is.an("object");
  expect(tokenData.user).to.have.property("id").that.is.a("number");
  expect(tokenData.user).to.have.property("username").that.is.a("string");
  expect(tokenData.user).to.have.property("email").that.is.a("string");
  expect(tokenData.user).to.have.property("is_admin").that.is.a("boolean");
  expect(tokenData.user).to.have.property("is_active").that.is.a("boolean");
  cy.log("✅ Token schema validation passed");
});

// ==================== CLEANUP COMMANDS ====================

Cypress.Commands.add("cleanupTestUsers", (userIds) => {
  cy.logStep("Cleaning up test users");

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    cy.logInfo(`No user IDs provided for cleanup`);
    return cy.wrap(null);
  }

  cy.logInfo(`Attempting to clean up ${userIds.length} test users`);

  return userIds.reduce((promise, userId) => {
    if (userId == null) {
      cy.logInfo(`Skipping null or undefined user ID`);
      return promise;
    }

    return promise.then(() => {
      return cy.getAuthHeaders().then((headers) => {
        return cy
          .request({
            method: "DELETE",
            url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${userId}`,
            headers: headers,
            failOnStatusCode: false,
          })
          .then((response) => {
            if (response.status === 204) {
              cy.logInfo(`Successfully deleted user ${userId}`);
            } else {
              cy.logInfo(
                `Note: Could not delete user ${userId}, status: ${response.status}`
              );
            }
            return cy.wrap(null);
          });
      });
    });
  }, cy.wrap(null)).then(() => {
    cy.logSuccess(`Cleanup process completed for ${userIds.length} user IDs`);
    return cy.wrap(null);
  });
});

Cypress.Commands.add("cleanupTestArtists", (artistIds) => {
  cy.logStep("Cleaning up test artists");

  if (!artistIds || !Array.isArray(artistIds) || artistIds.length === 0) {
    cy.logInfo(`No artist IDs provided for cleanup`);
    return cy.wrap(null);
  }

  cy.logInfo(`Attempting to clean up ${artistIds.length} test artists`);

  return artistIds.reduce((promise, artistId) => {
    if (artistId == null) {
      cy.logInfo(`Skipping null or undefined artist ID`);
      return promise;
    }

    return promise.then(() => {
      return cy.getAuthHeaders().then((headers) => {
        return cy
          .request({
            method: "DELETE",
            url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/artists/${artistId}`,
            headers: headers,
            failOnStatusCode: false,
          })
          .then((response) => {
            if (response.status === 204) {
              cy.logInfo(`Successfully deleted artist ${artistId}`);
            } else {
              cy.logInfo(
                `Note: Could not delete artist ${artistId}, status: ${response.status}`
              );
            }
            return cy.wrap(null);
          });
      });
    });
  }, cy.wrap(null)).then(() => {
    cy.logSuccess(`Cleanup process completed for ${artistIds.length} artist IDs`);
    return cy.wrap(null);
  });
});

Cypress.Commands.add("cleanupTestAlbums", (albumIds) => {
  cy.logStep("Cleaning up test albums");

  if (!albumIds || !Array.isArray(albumIds) || albumIds.length === 0) {
    cy.logInfo(`No album IDs provided for cleanup`);
    return cy.wrap(null);
  }

  cy.logInfo(`Attempting to clean up ${albumIds.length} test albums`);

  return albumIds.reduce((promise, albumId) => {
    if (albumId == null) {
      cy.logInfo(`Skipping null or undefined album ID`);
      return promise;
    }

    return promise.then(() => {
      return cy.getAuthHeaders().then((headers) => {
        return cy
          .request({
            method: "DELETE",
            url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/albums/${albumId}`,
            headers: headers,
            failOnStatusCode: false,
          })
          .then((response) => {
            if (response.status === 204) {
              cy.logInfo(`Successfully deleted album ${albumId}`);
            } else {
              cy.logInfo(
                `Note: Could not delete album ${albumId}, status: ${response.status}`
              );
            }
            return cy.wrap(null);
          });
      });
    });
  }, cy.wrap(null)).then(() => {
    cy.logSuccess(`Cleanup process completed for ${albumIds.length} album IDs`);
    return cy.wrap(null);
  });
});

Cypress.Commands.add("cleanupTestSongs", (songIds) => {
  cy.logStep("Cleaning up test songs");

  if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
    cy.logInfo(`No song IDs provided for cleanup`);
    return cy.wrap(null);
  }

  cy.logInfo(`Attempting to clean up ${songIds.length} test songs`);

  return songIds.reduce((promise, songId) => {
    if (songId == null) {
      cy.logInfo(`Skipping null or undefined song ID`);
      return promise;
    }

    return promise.then(() => {
      return cy.deleteSong(songId).then(() => {
        return cy.wrap(null);
      });
    });
  }, cy.wrap(null)).then(() => {
    cy.logSuccess(`Cleanup process completed for ${songIds.length} song IDs`);
    return cy.wrap(null);
  });
});

Cypress.Commands.add("cleanupTestPlaylists", (playlistIds) => {
  cy.logStep("Cleaning up test playlists");

  if (!playlistIds || !Array.isArray(playlistIds) || playlistIds.length === 0) {
    cy.logInfo(`No playlist IDs provided for cleanup`);
    return cy.wrap(null);
  }

  cy.logInfo(`Attempting to clean up ${playlistIds.length} test playlists`);

  return playlistIds.reduce((promise, playlistId) => {
    if (playlistId == null) {
      cy.logInfo(`Skipping null or undefined playlist ID`);
      return promise;
    }

    return promise.then(() => {
      return cy.deletePlaylist(playlistId).then(() => {
        return cy.wrap(null);
      });
    });
  }, cy.wrap(null)).then(() => {
    cy.logSuccess(`Cleanup process completed for ${playlistIds.length} playlist IDs`);
    return cy.wrap(null);
  });
});

// ==================== DEBUG COMMANDS ====================

Cypress.Commands.add("debugApiEndpoints", () => {
  cy.logStep("Debugging API endpoints and data");

  return cy.getAuthHeaders().then((headers) => {
    cy.log("=== Testing Songs Endpoint ===");
    cy.request({
      method: "GET",
      url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/songs/`,
      headers: headers,
      failOnStatusCode: false,
    }).then((response) => {
      cy.log(`Songs list status: ${response.status}`);
      if (response.status === 200) {
        cy.log(`Found ${response.body.length} songs`);
        cy.log("First few songs:", JSON.stringify(response.body.slice(0, 3), null, 2));
      } else {
        cy.log("Songs endpoint error:", response.body);
      }
    });

    cy.log("=== Testing API Health ===");
    return cy
      .request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/healthcheck`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((response) => {
        cy.log("Health check:", response.body);
      });
  });
});

Cypress.Commands.add("debugAddFavorite", (userId, songId) => {
  cy.logStep(`DEBUG: Adding song ${songId} to user ${userId} favorites`);

  return cy.getAuthHeaders().then((headers) => {
    return cy
      .request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${userId}`,
        headers: headers,
        failOnStatusCode: false,
      })
      .then((userResponse) => {
        cy.log(
          "User before adding favorite:",
          JSON.stringify(userResponse.body, null, 2)
        );

        return cy
          .request({
            method: "POST",
            url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${userId}/favorites/${songId}`,
            headers: headers,
            failOnStatusCode: false,
          })
          .then((response) => {
            cy.log("=== ADD FAVORITE RESPONSE ===");
            cy.log("Status:", response.status);
            cy.log("Headers:", JSON.stringify(response.headers, null, 2));
            cy.log("Body:", JSON.stringify(response.body, null, 2));
            cy.log("=== END RESPONSE ===");

            return cy
              .request({
                method: "GET",
                url: `${Cypress.env("apiUrl")}${Cypress.env("apiVersion")}/users/${userId}`,
                headers: headers,
                failOnStatusCode: false,
              })
              .then((afterResponse) => {
                cy.log(
                  "User after adding favorite:",
                  JSON.stringify(afterResponse.body, null, 2)
                );
                return cy.wrap(response.body);
              });
          });
      });
  });
});

// ==================== LOGGING COMMANDS ====================

Cypress.Commands.add("logStep", (message) => {
  Cypress.log({
    name: "📋",
    displayName: "STEP",
    message: message,
    consoleProps: () => {
      return {
        Step: message,
      };
    },
  });
});

Cypress.Commands.add("logInfo", (message) => {
  Cypress.log({
    name: "ℹ️",
    displayName: "INFO",
    message: message,
    consoleProps: () => {
      return {
        Info: message,
      };
    },
  });
});

Cypress.Commands.add("logSuccess", (message) => {
  Cypress.log({
    name: "✅",
    displayName: "SUCCESS",
    message: message,
    consoleProps: () => {
      return {
        Success: message,
      };
    },
  });
});

Cypress.Commands.add("logError", (message) => {
  Cypress.log({
    name: "❌",
    displayName: "ERROR",
    message: message,
    consoleProps: () => {
      return {
        Error: message,
      };
    },
  });
});

Cypress.Commands.add("logWarning", (message) => {
  Cypress.log({
    name: "⚠️",
    displayName: "WARNING",
    message: message,
    consoleProps: () => {
      return {
        Warning: message,
      };
    },
  });
});