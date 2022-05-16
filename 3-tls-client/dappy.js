// import x509 from "./x509.js";

// function getAllowedUsers(r) {
//   const rawAllowedUsers = r.variables.dappy_allowed_users || "";

//   r.log(rawAllowedUsers);

//   return rawAllowedUsers
//       .split("\n")
//       .filter(u => u.length > 0)
//       .map(u => u.replace(/(^\s+)|(\s+$)/, ''));
// }

async function auth(r) {
  // const users = getAllowedUsers(r);

  const caName = r.variables.dappy_allowed_ca;

  const cert = r.variables.ssl_client_raw_cert;
  // const altName = JSON.stringify(x509.get_oid_value(cert, "2.5.29.17"));

  const response = await r.subrequest("/verifysig", {
    method: "POST",
    body: JSON.stringify({
      cert,
      caName,
    }),
  });

  const verified = JSON.parse(response.responseText).result; 

  r.log(verified);

  // r.log(altName);
  // r.return(200, `${users}`);
  if (verified) {
    r.return(200, "OK");
  }
  else {
    r.return(403, "Forbidden");
  }
}

function version(r) {
  r.return(200, "1.0.0");
}

export default { auth, version };
