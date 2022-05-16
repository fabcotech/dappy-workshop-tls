const fs = require("fs");
const https = require("https");

const { runVerifySig } = require('./verifysig');

async function getData(req) {
  const buffers = [];

  for await (const chunk of req) {
    buffers.push(chunk);
  }

  return JSON.parse(Buffer.concat(buffers).toString());
}

https
  .createServer(
    {
      cert: fs.readFileSync("verifysig.pem"),
      key: fs.readFileSync("verifysig-key.pem"),
    },
    async (req, res) => {
      const { cert, caName } = await getData(req);

      const result = await runVerifySig(cert, caName);

      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);

      res.end(JSON.stringify({ result }));
    }
  )
  .listen(9443);