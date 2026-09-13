CREATE TABLE `user_vocabulary_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`decksJson` text NOT NULL,
	`statsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_vocabulary_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_vocabulary_data_userOpenId_unique` UNIQUE(`userOpenId`)
);
