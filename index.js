const { ApolloServer, gql } = require("apollo-server");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
// Construct a schema, using GraphQL schema language

let mongo;
let client;
let currentUser;
async function context(headers, secrets) {
  if (!mongo) {
    client = await MongoClient.connect(process.env.MDB_URL);
    mongo = client.db("clanwce");
  }
  return {
    headers,
    secrets,
    mongo,
    currentUser
  };
}

const TEMP_USER = {
  id: 1,
  email: "clanwce@gmail.com"
};

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
  }
`;

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    currentUser: () => {
      return TEMP_USER;
      // Return User
    },
    hello: (root, args, context) => "Hello world!"
  },
  Mutation: {
    login: (root, { email, password }, ctx) => {
      // Return User
    },
    signup: async (root, { email, password }, ctx) => {
      const Users = await ctx.mongo.collection("users");
      const existingUser = await Users.findOne({ email });
      if (existingUser) {
        throw new Error("Email already taken");
      }

      const hash = await bcrypt.hash(password, 10);
      await Users.insert({
        email,
        password: hash
      });
      const user = await Users.findOne({ email });

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
