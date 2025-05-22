const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    apiUrl: process.env.CYPRESS_API_URL || 'https://localhost:8000',

    
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
    experimentalRunAllSpecs: true,

    
    viewportWidth: 1280,
    viewportHeight: 720,

   
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,

    
    watchForFileChanges: false,
    screenshotOnRunFailure: true,

    
    env: {
      
      apiUrl: process.env.CYPRESS_API_URL || 'https://localhost:8000',
      apiVersion: process.env.CYPRESS_API_VERSION || '/v1',

      
      adminUsername: process.env.CYPRESS_ADMIN_USERNAME || 'admin',
      adminEmail: process.env.CYPRESS_ADMIN_EMAIL || 'admin@example.com',
      adminPassword: process.env.CYPRESS_ADMIN_PASSWORD || 'defaultpassword',
      apiKey: process.env.CYPRESS_API_KEY || 'default-api-key',

      
      testTimeout: process.env.CYPRESS_TEST_TIMEOUT || 30000,
      retries: process.env.CYPRESS_RETRIES || 2,

      
      environment: process.env.CYPRESS_ENVIRONMENT || 'local'
    },

    
    setupNodeEvents(on, config) {
      
      on('task', {
        log(message) {
          console.log(message)
          return null
        },

        
        generateTestUsers(count = 4) {
          const { faker } = require('@faker-js/faker')
          const users = []

          for (let i = 0; i < count; i++) {
            users.push({
              username: faker.internet.userName().toLowerCase(),
              email: faker.internet.email(),
              favorites: []
            })
          }

          return users
        },

        
        generateArtistData(count = 1) {
          const { faker } = require('@faker-js/faker')

          if (count === 1) {
            return {
              name: faker.person.fullName() + " Band",
              bio: faker.lorem.paragraph(2)
            }
          }

          const artists = []
          for (let i = 0; i < count; i++) {
            artists.push({
              name: faker.person.fullName() + " Band",
              bio: faker.lorem.paragraph(2)
            })
          }
          return artists
        },

        
        generateAlbumData(count = 1) {
          const { faker } = require('@faker-js/faker')
          const albums = []

          for (let i = 0; i < count; i++) {
            
            const albumTypes = [
              faker.lorem.words(2) + " Album",
              faker.lorem.word().charAt(0).toUpperCase() + faker.lorem.word().slice(1),
              "The " + faker.lorem.words(2),
              faker.lorem.words(3),
              faker.lorem.word() + " & " + faker.lorem.word()
            ]

            albums.push({
              title: faker.helpers.arrayElement(albumTypes),
              release_year: faker.date.between({
                from: '1960-01-01',
                to: new Date()
              }).getFullYear(),
              
            })
          }

          
          return count === 1 ? albums[0] : albums
        },

        
        generateSongData(count = 1) {
          const { faker } = require('@faker-js/faker')
          const songs = []

          const genres = [
            'Rock', 'Pop', 'Hip-Hop', 'Jazz', 'Blues', 'Country',
            'Electronic', 'Classical', 'R&B', 'Folk', 'Reggae',
            'Punk', 'Metal', 'Alternative', 'Indie', 'Dance'
          ]

          for (let i = 0; i < count; i++) {
            const songTypes = [
              faker.lorem.words(2),
              faker.lorem.words(3),
              "The " + faker.lorem.word(),
              faker.lorem.word() + " Song",
              faker.lorem.words(1) + " " + faker.lorem.words(1)
            ]

            songs.push({
              title: faker.helpers.arrayElement(songTypes),
              duration: faker.number.float({ min: 120.0, max: 360.0, precision: 0.1 }),
              genre: faker.helpers.arrayElement(genres),
              
            })
          }

          return count === 1 ? songs[0] : songs
        },

        
        generatePlaylistData(count = 1) {
          const { faker } = require('@faker-js/faker')
          const playlists = []

          for (let i = 0; i < count; i++) {
            
            const playlistTypes = [
              faker.lorem.words(2) + " Mix",
              "Best of " + faker.lorem.word(),
              faker.lorem.word() + " Vibes",
              faker.lorem.words(2) + " Playlist",
              "My " + faker.lorem.words(2),
              faker.lorem.word() + " Collection"
            ]

            playlists.push({
              name: faker.helpers.arrayElement(playlistTypes),
              description: faker.lorem.sentence(),
              song_ids: []
            })
          }

          return count === 1 ? playlists[0] : playlists
        },

        
        generateApiUserData(count = 1) {
          const { faker } = require('@faker-js/faker')
          const users = []

          for (let i = 0; i < count; i++) {
            users.push({
              username: faker.internet.userName().toLowerCase(),
              email: faker.internet.email(),
              password: faker.internet.password({ length: 12 }),
              is_admin: faker.datatype.boolean()
            })
          }

          return count === 1 ? users[0] : users
        },

       
        generateMusicTestData() {
          const { faker } = require('@faker-js/faker')

          const artist = {
            name: faker.person.fullName() + " Band",
            bio: faker.lorem.paragraph(2)
          }

          const album = {
            title: faker.lorem.words(2) + " Album",
            release_year: faker.date.between({
              from: '1990-01-01',
              to: new Date()
            }).getFullYear()
          }

          const songs = []
          for (let i = 0; i < 3; i++) {
            songs.push({
              title: faker.lorem.words(2),
              duration: faker.number.float({ min: 180.0, max: 300.0, precision: 0.1 }),
              genre: faker.helpers.arrayElement(['Rock', 'Pop', 'Jazz', 'Blues'])
            })
          }

          const playlist = {
            name: faker.lorem.words(2) + " Mix",
            description: faker.lorem.sentence()
          }

          return {
            artist,
            album,
            songs,
            playlist
          }
        },

        
        validateSchema(data) {
          const Ajv = require('ajv')
          const addFormats = require('ajv-formats')

          const ajv = new Ajv({ allErrors: true })
          addFormats(ajv)

          const { schema, payload } = data
          const validate = ajv.compile(schema)
          const valid = validate(payload)

          return {
            valid,
            errors: validate.errors
          }
        },

        
        generateBulkTestData(type, count = 10) {
          const { faker } = require('@faker-js/faker')
          const data = []

          switch (type) {
            case 'artists':
              for (let i = 0; i < count; i++) {
                data.push({
                  name: `${faker.person.fullName()} Band ${i}`,
                  bio: faker.lorem.paragraph(1)
                })
              }
              break

            case 'albums':
              for (let i = 0; i < count; i++) {
                data.push({
                  title: `${faker.lorem.words(2)} Album ${i}`,
                  release_year: faker.date.between({
                    from: '1980-01-01',
                    to: new Date()
                  }).getFullYear()
                })
              }
              break

            case 'songs':
              for (let i = 0; i < count; i++) {
                data.push({
                  title: `${faker.lorem.words(2)} Song ${i}`,
                  duration: faker.number.float({ min: 120.0, max: 400.0, precision: 0.1 }),
                  genre: faker.helpers.arrayElement(['Rock', 'Pop', 'Jazz', 'Electronic'])
                })
              }
              break

            case 'users':
              for (let i = 0; i < count; i++) {
                data.push({
                  username: `${faker.internet.userName().toLowerCase()}${i}`,
                  email: faker.internet.email(),
                  favorites: []
                })
              }
              break

            default:
              throw new Error(`Unknown data type: ${type}`)
          }

          return data
        },

       
        generateEdgeCaseData(type) {
          const { faker } = require('@faker-js/faker')

          switch (type) {
            case 'special-characters':
              return {
                name: "Björk & The Über Band's 'Special' Characters",
                bio: "Bio with émojis 🎵, quotes \"test\", and symbols: @#$%^&*()"
              }

            case 'long-content':
              return {
                name: 'A'.repeat(255),
                bio: faker.lorem.paragraphs(10)
              }

            case 'minimal-content':
              return {
                name: 'A',
                bio: 'B'
              }

            case 'unicode':
              return {
                name: 'пользователь тест 用户测试',
                bio: 'Biography with unicode: café, naïve, 北京, Москва'
              }

            default:
              throw new Error(`Unknown edge case type: ${type}`)
          }
        }
      })

      return config
    },
  },
})