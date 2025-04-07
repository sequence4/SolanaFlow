import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 9999;

console.log("JWT_SECRET:", process.env.JWT_SECRET);
console.log("TOKEN_EXPIRATION:", process.env.TOKEN_EXPIRATION);


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true })); 

app.get('/health', (req, res) => {
  res.send({
    status: 'UP',
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
