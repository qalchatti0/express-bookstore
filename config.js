/** Common config for bookstore. */


let DB_URI = `postgresql://`;

if (process.env.NODE_ENV === "test") {
  // TEST_DATABASE_URL lets you supply a user/password (needed on Windows); default is the local socket.
  DB_URI = process.env.TEST_DATABASE_URL || `${DB_URI}/books-test`;
} else {
  DB_URI = process.env.DATABASE_URL || `${DB_URI}/books`;
}


module.exports = { DB_URI };