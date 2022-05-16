const { X509Certificate } = require("crypto");
const { getCertificates } = require('@fabcotech/dappy-lookup');

function verifySig(rawCert, rawCACert) {
  const cert = new X509Certificate(rawCert);
  const caCert = new X509Certificate(rawCACert);
  return cert.verify(caCert.publicKey);
}

async function runVerifySig(cert, caName) {
  const caCert = await getCertificates(caName, {
    dappyNetwork: [
      { scheme: 'http', ip: '127.0.0.1', port: '3001', hostname: 'localhost' },
    ]
  });
  return verifySig(cert, caCert.answers[0].data);
}

module.exports = {
  runVerifySig,
  verifySig,
};
