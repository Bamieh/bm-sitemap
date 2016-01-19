'use strict';
var moment = require('moment');
var _ = require('lodash');
var fs = require('fs');
var cache = require('./cache');

module.exports = function createXmlBuilder() {
	return new XMLbuilder();
};

function XMLbuilder() {
	var xmlFile = {
		content: '',
		defaults: {
			filename: 'sitemap',
			header: '<?xml version="1.0" encoding="UTF8"?>',
			xmlnsArray: [
				'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"', //always keep the sitemap schema xmlns first
				'xmlns:xhtml="http://www.w3.org/1999/xhtml"'
			],
			tagSet: 'urlset',
			parentNodeTag: 'url',
			sitemapLimit: 10000,
			// sitemapLimit: 50000,
			currentDate: moment().format('YYYY-MM-DD')
		},
		appendContent: function (content) {
			this.content += content;
		},
		clearContent: function () {
			this.content = '';
		},
		getContent: function () {
			return this.content;
		},
		buildPath: function (options) {
			options.prefix = options.prefix || '';
			options.postfix = options.postfix || '';
			var finalPath =
				options.path +
				options.prefix +
				options.filename +
				options.postfix +
				options.extention;
			return finalPath;
		},
		clearStreamWriter: function () {
			cache.writer = null;
		}
	};
	var publicApi = {
		getDate: function() {
			return xmlFile.defaults.currentDate;
		},
		initiateXml: function (xmlHeader) {
			cache.xmlHeader = xmlHeader || cache.xmlHeader || xmlFile.defaults.header;
			xmlFile.appendContent(cache.xmlHeader);
			return publicApi;
		},
		openTagSet: function (tagSet, xmlnsArray) {
			if (cache.tagSetOpened) {
				return new Error('Cannot open new urlset before closing the previous one.');
			}

			cache.tagSet = tagSet || cache.tagSet || xmlFile.defaults.tagSet;
			cache.xmlnsArray = xmlnsArray || cache.xmlnsArray || xmlFile.defaults.xmlnsArray;

			var tagSetElement = '<';
			tagSetElement += cache.tagSet;

			_.each(cache.xmlnsArray, function (xmlns) {
				tagSetElement += ' ' + xmlns;
			});
			tagSetElement += '>';
			cache.tagSetOpened = true;

			xmlFile.appendContent(tagSetElement);
			return publicApi;
		},
		//make parentNodeTag a key inside the object, and make the childesnodesObject accept array itterations
		//save the length of the xmlFile, this way we be able to save the xml based on length not on url count, since
		appendNode: function (parentNodeTag, childnodesObject) {
			if (typeof parentNodeTag === 'object') {
				childnodesObject = parentNodeTag;
				parentNodeTag = null;
			}
			childnodesObject = childnodesObject || {};
			parentNodeTag = parentNodeTag || xmlFile.defaults.parentNodeTag;

			var xmlNode = '<'+parentNodeTag+'>';
			_.each(childnodesObject, function (content, tag) {
				if (tag === 'self-closing') {
					xmlNode += content;
				} else {
					xmlNode += '<'+tag+'>' + content + '</'+tag+'>';
				}
			});
			xmlNode+= '</'+parentNodeTag+'>';
			xmlFile.appendContent(xmlNode);
			xmlNode = null; //null to get it garbage collected. (check if this is needed);

			cache.urlCount++;
			cache.totalUrlCount++;
			return publicApi;
		},
		closeTagSet: function () {
			if (!cache.tagSetOpened) {
				return new Error('closeTagSet() called without having a tag set opened.');
			}
			xmlFile.appendContent('</'+cache.tagSet+'>');
			cache.tagSetOpened = false;
			return publicApi;
		},
		getTotalUrlCount: function () {
			return cache.totalUrlCount;
		},
		startAnotherStreamFile: function () {
			xmlFile.clearContent();
			this.initiateXml();
			this.openTagSet();
			this.startStreamFile();
			cache.urlCount = 0;
		},
		startStreamFile: function (tmpPath, filename) {
			cache.sitemapNumber++;
			cache.tmpPath = tmpPath || cache.tmpPath;
			cache.filename = filename || cache.filename || xmlFile.defaults.filename;

			if (!cache.tmpPath) {
				return new Error('startStreamFile() called without passing filepath.');
			}

			var completeTmpPath = xmlFile.buildPath({
				path: cache.tmpPath,
				filename: cache.filename,
				postfix: cache.sitemapNumber,
				extention: '.tmp.xml'
			}); //assets/sitemap/sitemap1.tmp.xml;

			cache.writer = fs.createWriteStream(completeTmpPath, {
				flags: 'w'
			});

			cache.writer.on('error', function (e) {
				return new Error('writeStream error event: '+ e);
			});

			cache.writer.on('finish', function () {
				// console.log('writeStream finish event');
			});

			return publicApi;
		},
		streamToDisk: function (skipLimit) {
			var writer = cache.writer;
			if (!writer) {
				return new Error('streamToDisk() called without creating a stream file.');
			}
			if (!skipLimit && cache.urlCount >= xmlFile.defaults.sitemapLimit) {
				this.closeTagSet();
				writer.write(xmlFile.getContent());
				this.closeStream();
				// console.log('singleFile set to false inside streamToDisk, limit loop');
				cache.singleFile = false;
				this.saveStreamFile(function (err) {
					if (err) {
						return new Error('err: '+ err);
					}
				});
				this.startAnotherStreamFile();
				// console.log('startAnotherStreamFile:', cache.urlCount);
				return;
			}

			writer.write(xmlFile.getContent());
			// console.log('streaming to disk done:', cache.urlCount);
			xmlFile.clearContent();
			return publicApi;
		},
		saveStreamFile: function (permanentPath, callback) {
			if (!cache.writer) {
				return new Error('saveStreamFile() called without creating a stream file.');
			}
			if (typeof permanentPath === 'function') {
				callback = permanentPath;
				permanentPath = null;
			}
			cache.permanentPath = permanentPath || cache.tmpPath;


			var FilePath = xmlFile.buildPath({
				path: cache.permanentPath,
				filename: cache.filename,
				postfix: cache.singleFile?'':cache.sitemapNumber,
				extention: '.xml'
			}); //assets/sitemap/sitemap.xml || assets/sitemap/sitemap1.xml;

			var TmpFilePath = xmlFile.buildPath({
				path: cache.tmpPath,
				filename: cache.filename,
				postfix: cache.sitemapNumber,
				extention: '.tmp.xml'
			}); //assets/sitemap/sitemap1.tmp.xml;

			fs.rename(TmpFilePath, FilePath, callback);
			xmlFile.clearStreamWriter();
			return publicApi;
		},
		closeStream: function () {
			var writer = cache.writer;
			if (!writer) {
				return new Error('closeStream() called without creating a stream file.');
			}
			writer.end();
			return publicApi;
		},
		writeInfoFile: function (path) {
			path = path || cache.permanentPath || cache.tmpPath;
			var jsonString = '{"sitemapDateGenerated":'+
								'"'+xmlFile.defaults.currentDate+'"'+
							',"singleSitemap":'+
								(cache.sitemapNumber === 1)+
							', "totleUrls":'+
								cache.totalUrlCount+
							', "path":'+
								'"'+cache.permanentPath+'"'+
							'}';
			fs.writeFileSync(path+'sitemapInfo.json', jsonString);
			return publicApi;
		},
		generateSitemapIndexes: function (sitemapsUrl) {
			if (!sitemapsUrl) {
				return new Error('cannot generate sitemapindex.xml with no url for sitemaps.');
			}
			//this is more like a helper function since you can do it on your own..
			var filePath = cache.permanentPath || cache.tmpPath;
			xmlFile.clearContent();
			this.initiateXml();

			this.openTagSet('sitemapindex', [xmlFile.defaults.xmlnsArray[0]]);
			var sitemapFilename = cache.filename;
			this.startStreamFile(filePath, 'sitemap-indexes');

			//put content in the file
			for (var i=1; i < cache.sitemapNumber; i++) {
				var fullLoc = xmlFile.buildPath({
					path: sitemapsUrl,
					filename: sitemapFilename,
					postfix: i,
					extention: '.xml'
				});
				this.appendNode('sitemap', {
					loc: fullLoc
				});
			}

			this.closeTagSet();
			this.streamToDisk(true);
			this.closeStream();
			cache.singleFile = true;
			this.saveStreamFile(function (err) {
				if (err) {
					return new Error('saveStreamFile generateSitemapIndexes Error: ' + err);
				}
				return publicApi;
			});
		}
	};
	return publicApi;
}
