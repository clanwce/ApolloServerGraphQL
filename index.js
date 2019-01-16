const { ApolloServer, gql } = require("apollo-server");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
// Construct a schema, using GraphQL schema language

let mongo;
let secrets;
let client;
let currentUser;
async function context(headers) {
  secrets = {
    MDB_URL: process.env.MDB_URL,
    MDB_USER: process.env.MDB_USER,
    MDB_PASSWORD: process.env.MDB_PASSWORD,
    JWT_SECRET: process.env.JWT_SECRET
  };
  if (!mongo) {
    client = await MongoClient.connect(
      secrets.MDB_URL,
      {
        auth: {
          user: secrets.MDB_USER,
          password: secrets.MDB_PASSWORD
        }
      },
      { useNewUrlParser: true }
    );
    mongo = client.db("clanwce");
  }
  currentUser = await getLoginUser(headers.authorization, secrets, mongo);

  return {
    headers,
    secrets,
    mongo,
    currentUser
  };
}

async function getLoginUser(authorization, secrets, mongo) {
  const bearerLength = "Bearer ".length;
  if (authorization && authorization.length > bearerLength) {
    const token = authorization.slice(bearerLength);
    try {
      const decodedObj = jwt.verify(token, secrets.JWT_SECRET);
      const user = await mongo
        .collection("users")
        .findOne({ _id: ObjectId(decodedObj._id) });
      return user;
    } catch (error) {
      console.error(error);
    }
    return null;
  }
}

const typeDefs = gql`
  type Query {
    currentUser: User
    hello: String
  }

  type Mutation {
    login(email: String!, password: String!): User
    signup(email: String!, password: String!): User
  }

  type User {
    _id: String
    email: String
    password: String
    token: String
  }
`;

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    currentUser: (root, args, ctx) => {
      return ctx.currentUser;
    },
    hello: (root, args, context) => "Hello world!"
  },
  Mutation: {
    login: async (root, { email, password }, ctx) => {
      const Users = await ctx.mongo.collection("users");
      const user = await Users.findOne({ email });
      if (!user) {
        throw new Error("Email Not Found");
      }

      const passwordCorrect = await bcrypt.compare(password, user.password);

      if (!passwordCorrect) {
        throw new Error("Password Does NOT Match");
      }

      user.token = jwt.sign({ _id: user._id }, ctx.secrets.JWT_SECRET);
      user._id = user._id + "";
      return user;
    },
    signup: async (root, { email, password }, ctx) => {
      const Users = await ctx.mongo.collection("users");
      const existingUser = await Users.findOne({ email });
      if (existingUser) {
        throw new Error("Email already taken");
      }

      const hash = await bcrypt.hash(password, 10);
      await Users.insertOne({
        email,
        password: hash
      });
      const user = await Users.findOne({ email });

      user.token = jwt.sign({ _id: user._id }, ctx.secrets.JWT_SECRET);
      user._id = user._id + "";
      return user;
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context
});

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
