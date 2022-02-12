import { config } from "../config.js";
import fetch from "node-fetch";
import Database from 'better-sqlite3';
const db = new Database(config.database.url);

export const getBalance = (): Promise<number> => {
    return new Promise(async (resolve, reject) => {
        // Make the request
        const data: any = await (await fetch(`http://${config.rpc.url}:${config.rpc.port}`, {
            method: `POST`,
            headers: {
                "Content-Type": `application/json`,
                Authorization: `Basic ${Buffer.from(`${config.rpc.user}:${config.rpc.password}`, "utf8").toString('base64')}`,
            },
            body: JSON.stringify({
                jsonrpc: `1.0`,
                id: `bkc-faucet`,
                method: `getbalance`,
                params: [],
            }),
        })).json().catch(() => undefined); // Return undefined if the request fails

        // Check if the RPC call was successful
        if (!data || !data.id) {
            reject("Authorization failed.");
            return;
        }

        // Check if the ID matches
        if (data.id !== `bkc-faucet`) {
            reject("Incorrect ID.");
            return;
        }

        // Check if the RPC call was successful
        if (data.error || !data.result) {
            reject(data.error.message);
            return;
        }

        // Return the balance
        resolve(data.result);
        return;
    });
};

export const sendCoins = (address: string, amount: number): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        // Make the request
        const data: any = await (await fetch(`http://${config.rpc.url}:${config.rpc.port}`, {
            method: `POST`,
            headers: {
                "Content-Type": `application/json`,
                Authorization: `Basic ${Buffer.from(`${config.rpc.user}:${config.rpc.password}`, "utf8").toString('base64')}`,
            },
            body: JSON.stringify({
                jsonrpc: `1.0`,
                id: `bkc-faucet`,
                method: `sendtoaddress`,
                params: [address, amount],
            }),
        })).json().catch(() => undefined); // Return undefined if the request fails

        // Check if the RPC call was successful
        if (!data || !data.id) {
            reject("Authorization failed.");
            return;
        }

        // Check if the ID matches
        if (data.id !== `bkc-faucet`) {
            reject("Incorrect ID.");
            return;
        }

        // Check if the RPC call was successful
        if (data.error || !data.result) {
            reject(data.error.message);
            return;
        }

        // Return the txid
        resolve(data.result);
        return;
    });
};

export const txidToValueAndAdress = async (txid: string): Promise<{ value: number, address: string }> => {
    return new Promise(async (resolve, reject) => {
        // Get the data from the database
        const data = db.prepare(`SELECT value, address FROM log WHERE txid=?`).all(txid);

        if (data.length < 1) {
            reject("Transaction not found.");
            return;
        }

        resolve(data.slice(-1)[0]);
        return;
    });
};

export const amountToSend = async (): Promise<number> => {
    return new Promise(async (resolve, reject) => {
        const walletBalance = await getBalance().catch(() => undefined); // Return undefined if the request fails
        if (walletBalance === undefined) {
            resolve(5);
            return;
        }
        resolve(parseFloat((walletBalance / 1000).toFixed(5)));
        return;
    });
};

export const verifyHcaptcha = (token: string): Promise<boolean> => {
    return new Promise(async (resolve, reject) => {
        // Make the request
        const data: any = await (await fetch(`https://hcaptcha.com/siteverify?secret=${config.hcaptcha}&response=${token}`, {
            method: `POST`,
            headers: {
                "Content-Type": `application/json`,
            },
        })).json().catch(() => undefined); // Return undefined if the request fails

        // Check if the request was successful and if the user passed the captcha
        if (!data || !data.success) {
            resolve(false);
            return;
        }

        // Return that the user passed the captcha
        resolve(true);
        return;
    });
}

export const logPayment = async (address: string, amount: number, txid: string) => {
    db.prepare(`INSERT INTO log (time, address, amount, txid) VALUES (?, ?, ?, ? )`).run(new Date().toUTCString().replace(`,`, ``), address, amount, txid);
};