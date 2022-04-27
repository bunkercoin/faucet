-- Create the tables
CREATE TABLE `limitByIP` (
    `ip` TEXT NOT NULL,
    `expires` INTEGER NOT NULL
);

CREATE TABLE `limitByAddress` (
    `address` TEXT NOT NULL,
    `expires` INTEGER NOT NULL
);

CREATE TABLE `log` (
    time TEXT NOT NULL,
    address TEXT NOT NULL,
    amount INTEGER NOT NULL,
    txid TEXT NOT NULL
);

CREATE TABLE `burn` (
    address TEXT NOT NULL
);

INSERT INTO `burn` VALUES ("B6BurnXXXXXXXXXXXXXXXXXXXXXXYLpz5G");
INSERT INTO `burn` VALUES ("BBBXXXXXXXXXXXXXXXXXXXXXXXXXXZNnj6");
