
const express = require("express");
const app = express();

const cors = require("cors");
const dotenv = require("dotenv");

app.use(cors());
app.use(express.json());
dotenv.config();

const port = process.env.PORT;

app.get("/", (req, res)=>{
    res.send("Hello World!");
})


app.listen(port , ()=>{
    console.log(`Sever Successfully run on port-${port}`)
})



