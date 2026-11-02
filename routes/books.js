const express = require("express");
const jsonschema = require("jsonschema");

const Book = require("../models/book");
const ExpressError = require("../expressError");
const bookNewSchema = require("../schemas/bookNew.json");
const bookUpdateSchema = require("../schemas/bookUpdate.json");

const router = new express.Router();


/** Validate data against a schema; throw a 400 ExpressError listing
 *  every validation error (not just the first) if it does not pass. */

function validate(data, schema) {
  const result = jsonschema.validate(data, schema);
  if (!result.valid) {
    const errors = result.errors.map(e => e.stack);
    throw new ExpressError(errors, 400);
  }
}


/** GET / => {books: [book, ...]}  */

router.get("/", async function (req, res, next) {
  try {
    const books = await Book.findAll(req.query);
    return res.json({ books });
  } catch (err) {
    return next(err);
  }
});

/** GET /[isbn]  => {book: book} */

router.get("/:isbn", async function (req, res, next) {
  try {
    const book = await Book.findOne(req.params.isbn);
    return res.json({ book });
  } catch (err) {
    return next(err);
  }
});

/** POST /   bookData => {book: newBook}  */

router.post("/", async function (req, res, next) {
  try {
    validate(req.body, bookNewSchema);
    const book = await Book.create(req.body);
    return res.status(201).json({ book });
  } catch (err) {
    return next(err);
  }
});

/** PUT /[isbn]   bookData => {book: updatedBook}  */

router.put("/:isbn", async function (req, res, next) {
  try {
    validate(req.body, bookUpdateSchema);
    if (req.body.isbn !== undefined && req.body.isbn !== req.params.isbn) {
      throw new ExpressError("isbn in body does not match isbn in URL", 400);
    }
    const book = await Book.update(req.params.isbn, req.body);
    return res.json({ book });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /[isbn]   => {message: "Book deleted"} */

router.delete("/:isbn", async function (req, res, next) {
  try {
    await Book.remove(req.params.isbn);
    return res.json({ message: "Book deleted" });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
