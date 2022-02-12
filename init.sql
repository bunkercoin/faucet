-- Create the limit by IP table
CREATE TABLE `limitByIP` (
    `ip` TEXT NOT NULL,
    `expires` INTEGER NOT NULL
);

-- Create the limit by address table
CREATE TABLE `limitByAddress` (
    `address` TEXT NOT NULL,
    `expires` INTEGER NOT NULL
);

-- Create the log table
CREATE TABLE `log` (
    time TEXT NOT NULL,
    address TEXT NOT NULL,
    amount INTEGER NOT NULL,
    txid TEXT NOT NULL
);