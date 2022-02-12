// Get variables from config.json
import { config } from "../config.js";

// Import packages
import { sha256 } from 'js-sha256';
import Database from 'better-sqlite3';
const db = new Database(config.database.url);
import express from "express";
const app = express();

import * as helper from "./helper.js";

app.use(express.urlencoded({ extended: true })); // Parse form data
app.set(`view engine`, `ejs`); // Set the view engine to ejs
app.set(`views`, `public`) // Set ejs directory

// https://github.com/expressjs/express/issues/4060 - To supress "Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client"
app.use((q, rs, n) => {
    const r = rs.render; const s = rs.send; rs.render = (...a: any) => { try { r.apply(rs, a) } catch { } }
    //@ts-ignore
    rs.send = (...a: any) => { try { s.apply(rs, a) } catch { } }; n()
});

app.use("/", express.static("public/static", { // Make CSS + favicon available
    "setHeaders": (response) => {
        response.set(`Cache-Control`, `public, max-age=604800, must-revalidate`); // Cache for 1 week
        response.set(`X-Powered-By`, `The Bunkercoin Team`);
    }
}));

app.get(`/`, async (request, response) => {
    response.header(`X-Powered-By`, `The Bunkercoin Team`);
    // Check if the user has already claimed their Bunkercoins
    if (request.query.status) {
        const status = request.query.status;
        if (status === "0") { // Success
            // Check if an txid was specified
            if (!request.query.txid || !request.query.value) {
                response.status(200).render(`error.ejs`, {
                    error: `Please specify a TXID and a value.`
                });
                return;
            }

            // Check if the txid is valid
            const txid = <string>request.query.txid;
            if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
                response.status(200).render(`error.ejs`, {
                    error: `Please specify a valid TXID.`
                });
                return;
            }

            const { value, address } = await helper.txidToValueAndAdress(txid).catch((error: string) => {
                response.status(200).render(`error.ejs`, {
                    error: error,
                });
                return { value: 0, address: "" };
            });

            response.status(200).render(`success.ejs`, {
                txid: txid,
                value: value,
                address: address,
            });
        } else if (status === "1") { // No address provided
            response.status(200).render(`error.ejs`, {
                error: "Please specify an address."
            });
        } else if (status === "2") { // Invalid address
            response.status(200).render(`error.ejs`, {
                error: "Please specify a valid address."
            });
        } else if (status === "3") { // User has already claimed Bunkercoins
            // Check if an address was specified
            if (!request.query.address) {
                response.status(200).render(`error.ejs`, {
                    error: `Please specify an address.`
                });
                return;
            }

            // Get the IP address of the user
            const ip = sha256((<string>request.headers["x-forwarded-for"]).split(",").slice(-1)[0]);
            const dateToClaim_ip = db.prepare(`SELECT expires FROM limitByIP WHERE ip=?`).get(ip);
            const dateToClaim_address = db.prepare(`SELECT expires FROM limitByAddress WHERE address=?`).get(request.query.address);

            const message = `Hi! It looks like you've already claimed your Bunkercoins for today! Please come back at `;

            if (dateToClaim_ip && dateToClaim_address) {
                if (dateToClaim_ip.expires > dateToClaim_address.expires) {
                    response.status(200).render(`error.ejs`, {
                        error: `${message}${new Date(dateToClaim_ip.expires).toLocaleString()}!`
                    });
                } else if (dateToClaim_ip.expires < dateToClaim_address.expires) {
                    response.status(200).render(`error.ejs`, {
                        error: `${message}${new Date(dateToClaim_address.expires).toLocaleString()}!`
                    });
                }
            } else if (dateToClaim_ip) {
                response.status(200).render(`error.ejs`, {
                    error: `${message}${new Date(dateToClaim_ip.expires).toLocaleString()}!`
                });
            } else if (dateToClaim_address) {
                response.status(200).render(`error.ejs`, {
                    error: `${message}${new Date(dateToClaim_address.expires).toLocaleString()}!`
                });
            } else {
                response.status(302).redirect(`/`);
            }
            return;
        } else if (status === "4") { // No hCaptcha response
            response.status(200).render(`error.ejs`, {
                error: `Please complete the hCaptcha.`
            });
        }
        return;
    }

    // Get the IP address of the user
    const ip = sha256((<string>request.headers["x-forwarded-for"]).split(",").slice(-1)[0]);
    const dateToClaim_ip = db.prepare(`SELECT expires FROM limitByIP WHERE ip=?`).get(ip);
    if (dateToClaim_ip) {
        response.status(200).render(`error.ejs`, {
            error: `Hi! It looks like you've already claimed your Bunkercoins for today! Please come back at ${new Date(dateToClaim_ip.expires).toLocaleString()}!`
        });
        return;
    }

    const balance = await helper.getBalance().catch((error: string) => {
        response.status(500).render(`error.ejs`, {
            error: error,
        });
    });

    try {
        response.status(200).render(`index.ejs`, {
            balance: balance,
        });
    } catch { }
});

app.post(`/receive`, async (request, response) => {
    // Check if an address was provided
    if (!request.body[`address`]) {
        response.status(302).redirect(`/?status=1`); // No address provided
        return;
    }

    if (!request.body[`h-captcha-response`]) {
        response.status(302).redirect(`/?status=4`); // No hCaptcha token provided
        return;
    }

    // Check if the user passed the hCaptcha test
    const passed = await helper.verifyHcaptcha(request.body[`h-captcha-response`]);
    if (!passed) {
        response.status(302).redirect(`/?status=4`); // No hCaptcha token provided
        return;
    }

    // Check if the address is a valid BKC address
    const address = <string>request.body.address;
    if (/^[B][a-zA-Z0-9]{33}$/.test(address)) {
        // Get the IP address of the user
        const ip = sha256((<string>request.headers["x-forwarded-for"]).split(",").slice(-1)[0]);

        // Check if the user received the coins already
        const byIP = db.prepare(`SELECT expires FROM limitByIP WHERE ip=?`).all(ip);
        const byAddress = db.prepare(`SELECT expires FROM limitByAddress WHERE address=?`).all(address);

        if (byIP.length > 0 && byAddress.length > 0) {
            if (byIP[0].expires > Date.now() || byAddress[0].expires > Date.now()) {
                response.status(302).redirect(`/?status=3&address=${address}`); // User has already claimed Bunkercoins
                return;
            } else {
                // If it expired, delete the record
                db.prepare(`DELETE FROM limitByIP WHERE ip=?`).run(ip);
                db.prepare(`DELETE FROM limitByAddress WHERE address=?`).run(address);
            }
        } else if (byIP.length > 0) {
            if (byIP[0].expires > Date.now()) {
                response.status(302).redirect(`/?status=3&address=${address}`); // User has already claimed Bunkercoins
                return;
            } else {
                // If it expired, delete the record
                db.prepare(`DELETE FROM limitByIP WHERE ip=?`).run(ip);
            }
        } else if (byAddress.length > 0) {
            if (byAddress[0].expires > Date.now()) {
                response.status(302).redirect(`/?status=3&address=${address}`); // User has already claimed Bunkercoins
                return;
            } else {
                // If it expired, delete the record
                db.prepare(`DELETE FROM limitByAddress WHERE address=?`).run(address);
            }
        }

        // Calulate how much coins they will get
        const amountToSend = await helper.amountToSend();

        // Send the coins
        const txid = await helper.sendCoins(address, amountToSend).catch((error: string) => {
            response.status(500).render(`error.ejs`, {
                error: error,
            });
            return "";
        });

        // Add the IP and address to the database
        db.prepare(`INSERT INTO limitByIP (ip, expires) VALUES (?, ?)`).run(ip, Date.now() + (1000 * 60 * 60 * 24));
        db.prepare(`INSERT INTO limitByAddress (address, expires) VALUES (?, ?)`).run(address, Date.now() + (1000 * 60 * 60 * 24));

        // Log the payment
        await helper.logPayment(address, amountToSend, txid);

        response.status(302).redirect(`/?status=0&txid=${txid}`); // Success

    } else {
        response.status(302).redirect(`/?status=2`); // Invalid address
    }
});

// Start the HTTP server
app.listen(config.port, () => {
    console.log(`Listening for http connections on port ${config.port}`);
});