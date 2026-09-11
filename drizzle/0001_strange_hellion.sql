CREATE TABLE `word_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`normalizedWord` varchar(191) NOT NULL,
	`word` varchar(191) NOT NULL,
	`translation` varchar(500) NOT NULL,
	`exampleSentence` text,
	`exampleTranslation` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `word_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `word_cache_normalizedWord_unique` UNIQUE(`normalizedWord`)
);
