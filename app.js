require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");
const mysql = require("mysql2/promise");
const { name } = require("ejs");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use("/assets", express.static(path.join(__dirname, "public", "assets")));

app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
    extensions: ["html", "htm"],
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

const db = mysql.createPool({
  host: "capstonedb.cfpgnjehw330.ap-south-1.rds.amazonaws.com",
  user: "dbadmin",
  password: "Capstondb025",
  database: "Capstonedb",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection()
  .then((connection) => {
    console.log("Connected to the database success!");
    connection.release();
  })
  .catch((err) => console.error("Database connection error:", err.stack));

const isAuthenticated = (req, res, next) => {
  if (req.session.user && req.session.user.isLoggedIn) {
    next();
  } else {
    res.redirect("/login.html?error=Please log in to access this page");
  }
};

app.post("/register", async (req, res) => {
  const { signupName, signupEmail, signupPassword, confirmPassword } = req.body;

  if (signupPassword !== confirmPassword) {
    return res.redirect("/login.html?message=passwords_mismatch");
  }

  try {
    // Check if the username already exists
    const [checkRows] = await db.execute(
      "SELECT * FROM students WHERE email = ?",
      [signupEmail]
    );

    if (checkRows.length > 0) {
      res.redirect("/login.html?message=email_exists");
    } else {
      const [result] = await db.execute(
        "INSERT INTO students (email, password, fullname) VALUES (?, ?, ?)",
        [signupEmail, signupPassword, signupName]
      );

      console.log("New user registered:", {
        email: signupEmail,
        name: signupName,
      });
      res.redirect(
        "/login.html?message=Registration successful! Please login."
      );
    }
  } catch (err) {
    console.error("Error registering user:", err);
    res.redirect("/login.html?message=db_error");
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.execute("SELECT * FROM students WHERE email = ?", [
      email,
    ]);

    if (rows.length > 0) {
      const user = rows[0];

      if (password === user.password) {
        console.log(`User ${email} logged in successfully`);

        req.session.user = {
          email: email,
          fullname: user.fullname,
          isLoggedIn: true,
        };

        res.redirect("/home");
      } else {
        res.redirect("/login.html?error=wrong_password");
      }
    } else {
      res.redirect("/login.html?error=user_not_found");
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Server error");
  }
});

app.get("/api/user-info", isAuthenticated, (req, res) => {
  res.json({
    email: req.session.user.email,
    fullname: req.session.user.fullname,
  });
});

app.get("/home", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});
app.get("/video", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "video.html"));
});
app.get("/", (req, res) => {
  if (req.session.user && req.session.user.isLoggedIn) {
    res.redirect("/home");
  } else {
    res.redirect("/index.html");
  }
});

app.get("/login.html", (req, res) => {
  if (req.session.user && req.session.user.isLoggedIn) {
    res.redirect("/home");
  } else {
    res.sendFile(path.join(__dirname, "public", "login.html"));
  }
});

app.post("/logout", (req, res) => {
  // Destroy the session
  req.session.destroy(() => {
    // Clear any authentication cookies
    res.clearCookie("connect.sid"); // Replace with your session cookie name if different

    // Redirect to home page
    res.redirect("/?message=logged_out successfully");
  });
});

app.use((req, res) => {
  res.status(404).send("Page not found");
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
