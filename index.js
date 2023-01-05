require("dotenv").config();

const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const {
  ApolloGateway,
  IntrospectAndCompose,
  RemoteGraphQLDataSource,
} = require("@apollo/gateway");
const { JsonWebTokenError, verify } = require("jsonwebtoken");

const secret = process.env.TOKEN_SECRET;

function JWTverify(token, secret) {
  if (!token) throw new JsonWebTokenError("Access denied");
  let verified = verify(token, secret, function (err, dataFromToken) {
    if (err && err.message == "jwt expired") {
      throw new JsonWebTokenError("Token expired");
    } else if (err && err.message != "jwt expired") {
      throw new JsonWebTokenError("Bad token");
    } else {
      return dataFromToken;
    }
  });
  return verified;
}

const ACTIONS = [
  "GetMenu",
  "UpdateMenu",
  "AddItemToMenu",
  "UpdateMinDeliveryPrice",
  "UpdateAddress",
  "acceptOrder",
  "OrderDelivered",
  "OrderRejected",
  "OrderPickedUp",
  "GetOrdersReadyForPickup",
];

// Initialize an ApolloGateway instance and pass it
const gateway = new ApolloGateway({
  serviceList: [
    { name: "delivery", url: "http://10.245.132.173:4001/" },
    { name: "menu", url: "http://10.245.20.204:4001/" },
    // ...additional services...
  ],
  // Pass the JWT token for authentication
  buildService({ name, url }) {
    let remote = new RemoteGraphQLDataSource({ url });
    remote.willSendRequest = function ({ request, context }) {
      // pass the user's token from the context to underlying services
      // as a header called `token`

      // check if context.introspect is in PUBLIC_ACTIONS if it is JWTverify the token
      if (ACTIONS.includes(context.introspect)) {
        const decodeToken = JWTverify(context.token, secret);
        request.http.headers.set("userId", decodeToken._id);
        request.http.headers.set("userRole", decodeToken.role);
      }

      console.log(context.introspect);
    };
    return remote;
  },
});

// Pass the ApolloGateway to the ApolloServer constructor
const server = new ApolloServer({
  gateway,
  subscriptions: false,
});

async function startServer() {
  const { url } = await startStandaloneServer(server, {
    context: async ({ req }) => ({
      token: req.headers.token,
      introspect: req.body.operationName,
    }),
    listen: { port: 4000 },
  });
  return url;
}

startServer().then((url) => console.log(`🚀  Server ready at ${url}`));
