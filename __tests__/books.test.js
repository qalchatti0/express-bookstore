/** Integration tests for /books routes. Runs against the "books-test" DB. */

process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../app");
const db = require("../db");

const BOOK = {
  isbn: "0691161518",
  amazon_url: "http://a.co/eobPtX2",
  author: "Matthew Lane",
  language: "english",
  pages: 264,
  publisher: "Princeton University Press",
  title: "Power-Up: Unlocking the Hidden Mathematics in Video Games",
  year: 2017
};

beforeAll(async () => {
  await db.query("DROP TABLE IF EXISTS books");
  await db.query(`CREATE TABLE books (
    isbn TEXT PRIMARY KEY,
    amazon_url TEXT,
    author TEXT,
    language TEXT,
    pages INTEGER,
    publisher TEXT,
    title TEXT,
    year INTEGER
  )`);
});

beforeEach(async () => {
  await db.query("DELETE FROM books");
  await db.query(
    `INSERT INTO books (isbn, amazon_url, author, language, pages, publisher, title, year)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    Object.values(BOOK));
});

afterAll(async () => {
  await db.query("DROP TABLE IF EXISTS books");
  await db.end();
});

/** Silence ExpressError's console.error stack dumps during error-path tests. */
beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => console.error.mockRestore());


describe("GET /books", () => {
  test("returns all books", async () => {
    const resp = await request(app).get("/books");
    expect(resp.statusCode).toBe(200);
    expect(resp.body).toEqual({ books: [BOOK] });
  });
});

describe("GET /books/:isbn", () => {
  test("returns one book", async () => {
    const resp = await request(app).get(`/books/${BOOK.isbn}`);
    expect(resp.statusCode).toBe(200);
    expect(resp.body).toEqual({ book: BOOK });
  });

  test("404 for unknown isbn", async () => {
    const resp = await request(app).get("/books/doesnotexist");
    expect(resp.statusCode).toBe(404);
  });
});

describe("POST /books", () => {
  const NEW = { ...BOOK, isbn: "1111111111", title: "Another Book" };

  test("creates a valid book", async () => {
    const resp = await request(app).post("/books").send(NEW);
    expect(resp.statusCode).toBe(201);
    expect(resp.body).toEqual({ book: NEW });

    const check = await request(app).get("/books/1111111111");
    expect(check.body.book).toEqual(NEW);
  });

  test("400 when required fields are missing, listing every error", async () => {
    const resp = await request(app).post("/books").send({ isbn: "2222222222" });
    expect(resp.statusCode).toBe(400);
    expect(Array.isArray(resp.body.message)).toBe(true);
    // 7 required fields missing: amazon_url, author, language, pages, publisher, title, year
    expect(resp.body.message).toHaveLength(7);
    expect(resp.body.message).toContain('instance requires property "title"');
  });

  test("400 when types are wrong, reporting each wrong field", async () => {
    const resp = await request(app).post("/books")
      .send({ ...NEW, pages: "lots", year: "last year" });
    expect(resp.statusCode).toBe(400);
    expect(resp.body.message).toHaveLength(2);
    expect(resp.body.message.join(" ")).toMatch(/pages/);
    expect(resp.body.message.join(" ")).toMatch(/year/);
  });

  test("400 when an unknown field is sent", async () => {
    const resp = await request(app).post("/books").send({ ...NEW, price: 10 });
    expect(resp.statusCode).toBe(400);
    expect(resp.body.message.join(" ")).toMatch(/price/);
  });

  test("400 for a non-positive page count", async () => {
    const resp = await request(app).post("/books").send({ ...NEW, pages: 0 });
    expect(resp.statusCode).toBe(400);
  });

  test("400 for an invalid amazon_url", async () => {
    const resp = await request(app).post("/books").send({ ...NEW, amazon_url: "not a url" });
    expect(resp.statusCode).toBe(400);
  });

  test("400 for an empty body", async () => {
    const resp = await request(app).post("/books").send({});
    expect(resp.statusCode).toBe(400);
  });

  test("400 for a duplicate isbn", async () => {
    const resp = await request(app).post("/books").send(BOOK);
    expect(resp.statusCode).toBe(400);
    expect(resp.body.message).toMatch(/already/);
  });
});

describe("PUT /books/:isbn", () => {
  const { isbn, ...fields } = BOOK;

  test("updates a book", async () => {
    const resp = await request(app).put(`/books/${isbn}`)
      .send({ ...fields, title: "New Title", pages: 300 });
    expect(resp.statusCode).toBe(200);
    expect(resp.body.book).toEqual({ ...BOOK, title: "New Title", pages: 300 });
  });

  test("accepts a body that repeats the same isbn", async () => {
    const resp = await request(app).put(`/books/${isbn}`).send({ ...BOOK, pages: 301 });
    expect(resp.statusCode).toBe(200);
    expect(resp.body.book.pages).toBe(301);
  });

  test("400 when the body isbn differs from the URL isbn", async () => {
    const resp = await request(app).put(`/books/${isbn}`).send({ ...BOOK, isbn: "9999999999" });
    expect(resp.statusCode).toBe(400);
  });

  test("400 when fields are missing, listing every error", async () => {
    const resp = await request(app).put(`/books/${isbn}`).send({ title: "Only a title" });
    expect(resp.statusCode).toBe(400);
    expect(resp.body.message).toHaveLength(6);
  });

  test("400 when types are wrong", async () => {
    const resp = await request(app).put(`/books/${isbn}`).send({ ...fields, year: "2017" });
    expect(resp.statusCode).toBe(400);
  });

  test("invalid update leaves the stored book unchanged", async () => {
    await request(app).put(`/books/${isbn}`).send({ ...fields, pages: -5 });
    const check = await request(app).get(`/books/${isbn}`);
    expect(check.body.book).toEqual(BOOK);
  });

  test("404 for unknown isbn", async () => {
    const resp = await request(app).put("/books/doesnotexist").send(fields);
    expect(resp.statusCode).toBe(404);
  });
});

describe("DELETE /books/:isbn", () => {
  test("deletes a book", async () => {
    const resp = await request(app).delete(`/books/${BOOK.isbn}`);
    expect(resp.statusCode).toBe(200);
    expect(resp.body).toEqual({ message: "Book deleted" });

    const check = await request(app).get(`/books/${BOOK.isbn}`);
    expect(check.statusCode).toBe(404);
  });

  test("404 for unknown isbn", async () => {
    const resp = await request(app).delete("/books/doesnotexist");
    expect(resp.statusCode).toBe(404);
  });
});

describe("unknown route", () => {
  test("404 handler", async () => {
    const resp = await request(app).get("/nope");
    expect(resp.statusCode).toBe(404);
  });
});
