const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000;

app.use(cookieParser());
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
}))
app.use(express.json());


// const uri = "mongodb+srv://<username>:<password>@cluster0.khubzpr.mongodb.net/?retryWrites=true&w=majority";

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.khubzpr.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
})

// my custom middleware
const logger = async (req, res, next) => {
    // console.log("called:", req.host, req.originalUrl)

    // console.log('hostname:', req.hostname);
    // console.log('url:', req.originalUrl);
    next();
}

const verifyToken = async (req, res, next) => {
    const token = req.cookies.token;
    // console.log('value of token in middleware', token);
    if (!token) {
        return res.status(401).send({ message: 'not authorized' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized' })
        }
        // console.log('decoded user',decoded)
        req.user = decoded;
        next()
    })
}

async function run() {
    try {
        // await client.connect();

        const serviceCollection = client.db('carDoctor').collection('carServices');
        const bookingCollection = client.db('carDoctor').collection('bookings');

        //auth related api
        app.post('/jwt', logger, async (req, res) => {
            const user = req.body;
            console.log('user data',user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' });
            // console.log('token', token)
            res.cookie('token', token, {
                httpOnly: true,
                secure: false
            })
            res.send({ success: true });
        })


        //service related api
        app.get('/services', logger, async (req, res) => {
            const cursor = serviceCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/services/:id', logger, async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const query = { _id: new ObjectId(id) }
            const result = await serviceCollection.findOne(query);
            res.send(result);
        })

        //bookings
        app.get('/bookings', logger, verifyToken, async (req, res) => {
            console.log('req.query data',req.query)
            // console.log('token', req.cookies.token)
            console.log('requested user', req.user)
            console.log(req.query)
            if (req.query.email !== req.user.email) {
                return res.status(403).send({ message: 'forbidden access', status: 403 })
            }


            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email };
            }
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

        app.get('/bookings/:id', logger, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingCollection.findOne(query);
            res.send(result);
        })

        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedBooking = req.body;
            // console.log(updatedBooking)
            const updatedData = {
                $set: {
                    status: updatedBooking.status
                }
            };
            const result = await bookingCollection.updateOne(filter, updatedData);
            res.send(result);
        })

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Car doctor is running!!')
})

app.listen(port, () => {
    console.log(`Car doctor port is running on PORT: ${port}`)
})