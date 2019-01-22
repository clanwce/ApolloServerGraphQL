//DP Demo App GraphQL API w/ Apollo Server & MongoDB

const { ApolloServer, gql } = require("apollo-server");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
  headers.authorization =
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1YzNlOGRmYmE3ZGIyZjAwYWViMmFlOTciLCJpYXQiOjE1NDgxNDYxMDF9.CKtuwoh8BhxxA7N-s4m73xWE6NmyDtVsg7wzOKCE4wE";
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
    deals: [Deal]
    deal_vote(userId: String!, dealId: String!): Boolean
  }

  type Mutation {
    login(email: String!, password: String!): User
    signup(email: String!, password: String!): User
    vote_deal(deal_id: String!, vote: Boolean!): Boolean
  }

  type User {
    _id: String
    email: String
    password: String
    token: String
  }

  type Deal {
    _id: String
    title: String
    description: String
    votes: Int
    voted: Boolean
  }

  type DealVote {
    _id: String
    userId: String
    dealId: String
  }
`;

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    currentUser: (root, args, ctx) => {
      return ctx.currentUser;
    },
    hello: (root, args, ctx) => "Hello world!",
    deals: async (root, args, ctx) => {
      const Deals = await ctx.mongo.collection("deals");
      const DealVotes = await ctx.mongo.collection("deal_votes");
      const allDeals = await Deals.find();
      let deals = await allDeals.toArray();

      for (let index in deals) {
        deals[index].voted = false;
        if (ctx.currentUser) {
          let deal_vote = await DealVotes.findOne({
            user_id: ctx.currentUser._id + "",
            deal_id: deals[index]._id + ""
          });
          console.log(deal_vote);
          deals[index].voted = deal_vote ? true : false;
        }
        deals[index]._id = deals[index]._id + "";
      }
      console.log(deals);
      return deals;
    },
    deal_vote: async (root, { userId, dealId }, ctx) => {
      const DealVotes = await ctx.mongo.collection("deal_votes");
      const dealVote = await DealVotes.findOne({
        user_id: userId,
        deal_id: dealId
      });
      if (dealVote) {
        return true;
      } else {
        return false;
      }
    }
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
    },
    vote_deal: async (root, { deal_id, vote }, ctx) => {
      if (!ctx.currentUser) {
        return false;
      }
      const user_id = ctx.currentUser._id + ""; //convert to string
      const DealVotes = await ctx.mongo.collection("deal_votes");
      const existingVote = await DealVotes.findOne({
        user_id,
        deal_id
      });
      if (vote) {
        if (!existingVote) {
          await DealVotes.insertOne({ user_id, deal_id });
        }
      } else {
        if (existingVote) {
          await DealVotes.remove({ user_id, deal_id });
        }
      }
      return true;
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
