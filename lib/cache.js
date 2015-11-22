'use strict';
// cache(xmlHeader); //get
// cache(xmlHeader, 'newValue'); //set

module.exports = {
	xmlHeader: null,
	tagSet: null,
	writer: null,
	tmpPath: null,
	urlCount: 0,
	totalUrlCount: 0,
	sitemapNumber: 0,
	xmlnsArray: null,
	tagSetOpened: false,
	singleFile: true,
	filename: null,
	permanentPath: null
};
