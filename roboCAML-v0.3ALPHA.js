/*
 * roboCAML - Dynamically create CAML client side
 * Version 0.3
 * @requires jQuery
 *
 * Copyright (c) 2011 Matthew P. Bramer
 * Examples and docs at:
 * http://roboCAML.codeplex.com
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */
/**
 * @description Dynamically create CAML client side
 * @type jQuery
 * @name roboCAML
 * @category Module/roboCAML
 * @author Matthew P. Bramer/matthewpaulbramer@hotmail.com
 */
var roboCAML = (function( $ ) {

	//Globals
	var SOAPEnvelope = {
		header: "<soap:Envelope xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:soap='http://schemas.xmlsoap.org/soap/envelope/'><soap:Body>",
		footer: "</soap:Body></soap:Envelope>"
	},
		INVALID_CAML = "<INVALID CAML />",
		//Used to prevent CAML string from being too long and choking the query.
		DEFAULT_CAML = "<Where><Neq><FieldRef Name='ID' /><Value Type='Counter'>0</Value></Neq></Where>",
		CAML_TAG_VIEW_OPEN = "<View>",
		CAML_TAG_VIEW_CLOSE = "</View>",
		CAML_TAG_QUERY_OPEN = "<Query>",
		CAML_TAG_QUERY_CLOSE = "</Query>",
		CAML_TAG_WHERE_OPEN = "<Where>",
		CAML_TAG_WHERE_CLOSE = "</Where>",
		//Used to cache the siteURL for the GetList Web Service call.
		thisSite = "",
		//Used to cache the list properties that have been queried.
		listProperties = {},

		//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
					//Util functions
		//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		wrapNode = function( n, v ) {
				// Wrap an XML node (n) around a value (v)
				return "<" + n + ">" + v + "</" + n + ">";
		},
		wrapFieldRef = function( v, lookupId ) {
			if ( lookupId ) {
				return "<FieldRef Name='" + v + "' LookupId='True' />";
			}
			return "<FieldRef Name='" + v + "' />";
		},
		wrapValueType = function( columnType, v ) {
			return "<Value Type='" + columnType + "'>" + v + "</Value>";
		},
		//Get List Properties
		GetList = function( opt ) {
			//Return listProperties if already cached.
			if ( listProperties[ opt.listName ] ) {
				//console.log( "returning cached results");
				//console.dir( listProperties[ opt.listName] );
				return listProperties[ opt.listName ];
			}

			//Object to be returned w/ list information
			var returnProps = {},
				// Build the URL for the Ajax call based on which operation we're calling
				// If the webURL has been provided, then use it, else use the current site
				ajaxURL = "_vti_bin/Lists.asmx";

			if ( opt.hasOwnProperty("webURL") ) {
				if ( opt.webURL.charAt( opt.webURL.length - 1 ) === "/") {
					ajaxURL = opt.webURL + ajaxURL;
				} else if ( opt.webURL.length > 0 ) {
					ajaxURL = opt.webURL + "/" + ajaxURL;
				}
			} else {
				ajaxURL = GetWeb() + "/" + ajaxURL;
			}

			var soapEnv = SOAPEnvelope.header + "<GetList xmlns='http://schemas.microsoft.com/sharepoint/soap/'><listName>" + opt.listName + "</listName></GetList>" + SOAPEnvelope.footer;

			$.ajax({
				url: ajaxURL,
				async: false,
				type: "POST",
				data: soapEnv,
				dataType: "xml",
				contentType: "text/xml;charset='utf-8'",
				complete: function(xData, Status) {
					//console.log(Status);
					//console.log(xData.responseText);
					//console.log(xData.responseXML.xml);
					$(xData.responseXML).find("Fields > Field").each( function() {
						var $node = $(this);
						//console.log( "Type: " + $(this).attr("Type") + " StaticName: " + $(this).attr("StaticName") );

						if ( $node.attr("StaticName") ) {
							returnProps[ $node.attr("StaticName") ] = $node.attr("Type");
						} else {
							//Fixed edge case when StaticName is undefined
							returnProps[ $node.attr("Name") ] = $node.attr("Type");
						}
					});
				}
			});
			return returnProps;
		},
		GetWeb = function() {

			if ( thisSite ) {
				return thisSite;
			}

			var msg = SOAPEnvelope.header +
					"<WebUrlFromPageUrl xmlns='http://schemas.microsoft.com/sharepoint/soap/' ><pageUrl>" +
					location.href.split("?")[0] + "</pageUrl></WebUrlFromPageUrl>" +
					SOAPEnvelope.footer;

			$.ajax({
				async: false, // Need this to be synchronous so we're assured of a valid value
				url: "/_vti_bin/Webs.asmx",
				type: "POST",
				data: msg,
				dataType: "xml",
				contentType: "text/xml;charset=\"utf-8\"",
				complete: function (xData, Status) {
					//console.log($(xData.responseXML).find("WebUrlFromPageUrlResult").text());
					thisSite = $(xData.responseXML).find("WebUrlFromPageUrlResult").text();
				}
			});
			return thisSite; // Return the URL
		}, //End of GetWeb

		//Determines what type of parameter is being passed
		//http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/
		toType = function(obj) {
			return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
		},

		//Used to normalize the text for CAML; e.g. && === "And"
		CorrectCAML = function ( node ) {
			if ( toType( node ) === "boolean" ) {

				//Which one is it?
				if ( node ) {
					return "True";
				} else {
					return "False";
				}
			//Find and normalize CAML operators that are string based.
			//Suggestions to add more are welcome...
			} else {
				switch( node.toLowerCase() ) {
					//Function will return correct CAML values that are passed into roboCAML.Query
					//debugger;
		/* ~~~~~~~ Filter portion ~~~~~~~ */
					//And
					case "&&":
					case "&":
					case "and":
						return "And";

					//Or
					case "||":
					case "or":
						return "Or";

		/* ~~~~~~~ Ops portion ~~~~~~~~ */
					case "equal":
					case "equals":
					case "=":
					case "eq":
						return "Eq";

					//Not Equals
					case "neq":
					case "not equal":
					case "not equals":
					case "!=":
						return "Neq";

					//Greater than
					case "gt":
					case ">":
						return "Gt";

					//Greater than or equal to
					case "geq":
					case ">=":
						return "Geq";

					//Less than
					case "lt":
					case "<":
						return "Lt";

					//Less than or equal to
					case "leq":
					case "<=":
						return "Leq";

					//IsNull
					case "isnull":
					case "null":
						return "IsNull";

					//IsNotNull
					case "isnotnull":
					case "not null":
						return "IsNotNull";

					//BeginsWith
					case "beginswith":
					case "begins with":
					case "^":
						return "BeginsWith";

					//Contains
					case "contains":
					case "*":
						return "Contains";

					//DateRangesOverlap
					case "daterangesoverlap":
					case "dateoverlap":
						return "DateRangesOverlap";

		/* ~~~~~~~ Misc portion ~~~~~~~~ */
					case "true":
						return "True";
					case "false":
						return "False";
					case "update":
						return "Update";
					case "delete":
						return "Delete";
					case "new":
						return "New";
				}
			}
		},	//End of NormalizeOp

		camlQueryOptions = function( opt, clientOm ) {
			var camlOptions = "";

			if ( toType( opt.ViewFields ) === "array" && clientOm ) {
				camlOptions = roboCAML.ViewFields( opt.ViewFields );
			}
		};

	//Begin roboCAML methods
	return {
		ViewFields: function( arr ) {
			if ( toType( arr ) === "array" ) {
				//local vars
				var loopLength = arr.length,
					//Begin return string
					camlViewFields = "<ViewFields>";

				//console.log(loopLength);
				//Using a while loop b/c it's the fastest loop and the order of ViewFields doesn't matter
				while ( loopLength-- ) {
					//console.log(arr[loopLength]);
					camlViewFields += wrapFieldRef( arr[ loopLength ] );
				}

				camlViewFields += "</ViewFields>";
				return camlViewFields;
			}
		},
		BatchCMD: function( opt ) {
			//Cache array.length
			var loopLength,
				//Begin batch string
				batch = "<Batch OnError='Continue'>",
				//Store the array.length within the array that's passed in
				fieldNum,
				/*  These vars may cause issues w/ being cached.  Verify when testing */
				i,
				fieldNames;

			//Default to update ~ needed this to allow a mixed batchCMD to be created
			opt.batchCMD =  ( opt.batchCMD ) ? CorrectCAML( opt.batchCMD ) : "Update";

			switch ( opt.batchCMD.toLowerCase() ) {
				case "delete":
					loopLength = opt.IDs.length;
					while ( loopLength-- ) {
						batch += "<Method ID='" + ( loopLength + 1 ) + "' Cmd='" + opt.batchCMD + "'><Field Name='ID'>" + opt.IDs[ loopLength ] + "</Field></Method>";
					}
					batch += "</Batch>";

					return batch;

				case "new":
					//console.log(opt.valuePairs.length);
					loopLength = opt.valuePairs.length;

					for ( i=0; i < loopLength; i++ ) {
						//console.log(opt.valuePairs[i].length);
						batch += "<Method ID='" + ( i + 1 ) + "' Cmd='" + opt.batchCMD + "'>";
						fieldNum = opt.valuePairs[ i ].length;

						for ( fieldNames=0; fieldNames < fieldNum; fieldNames = fieldNames+2 ) {
							batch += "<Field Name='" + opt.valuePairs[ i ][ fieldNames ] + "'>" + opt.valuePairs[ i ][ ( fieldNames + 1 ) ] + "</Field>";
							//console.log(batch);
						}
						batch += "</Method>";
					}
					batch += "</Batch>";
					return batch;

				//Defaults to update to facilitate updates that can contain all of the options: New, Delete, & Update
				//case "update":
				default:
					//console.log("updates length: " + opt.updates.length);

					loopLength = opt.updates ? opt.updates.length : opt.IDs.length;

					if ( opt.hasOwnProperty( "IDs" ) ) {
						for ( i=0; i<loopLength; i++ ) {
							//console.log(opt.valuePairs[i].length);
							batch += "<Method ID='" + ( i + 1 ) + "' Cmd='" + opt.batchCMD + "'>";

							for ( fieldNames=0, fieldNum = opt.valuePairs[ i ].length; fieldNames < fieldNum; fieldNames = fieldNames + 2 ) {
								batch += "<Field Name='" + opt.valuePairs[ i ][ fieldNames ] + "'>" + opt.valuePairs[ i ][ ( fieldNames + 1 ) ] + "</Field>";
								//console.log(batch);
							}
							//Get ID from opt.IDs
							batch += "<Field Name='ID'>" + opt.IDs[ i ] + "</Field></Method>";
						}
					} else {
						for ( i=0; i < loopLength; i++ ) {
							//console.dir(opt.valuePairs[i].length);

							//Caches current object that's being enumerated.
							var currObj = opt.updates[ i ],

								//Allows a Cmd to be passed within the object or defaults to the global option: batchCMD.
								crudOp = ( currObj.batchCMD ) ? CorrectCAML( currObj.batchCMD ) : opt.batchCMD;

							//console.dir( currObj.valuePairs.length );

							batch += "<Method ID='" + ( i + 1 ) + "' Cmd='" + crudOp + "'>";

							if ( crudOp === "Delete" ) {
								batch += "<Field Name='ID'>" + currObj.ID + "</Field></Method>";
							} else {
								for ( fieldNames=0, fieldNum = currObj.valuePairs.length; fieldNames < fieldNum; fieldNames = fieldNames + 2 ) {
									//debugger;
									batch += "<Field Name='" + currObj.valuePairs[ fieldNames ] + "'>" + currObj.valuePairs[ ( fieldNames + 1 ) ] + "</Field>";
									//console.log(batch);
								}
							}



							batch += "</Method>";
							//Get ID from opt.IDs
							//batch += "<Field Name='ID'>" + currObj.ID + "</Field></Method>";
						}
					}
					batch += "</Batch>";
					return batch;
			}
		},
		Query: function( opt ) {
			var prop,
				//Store listProperties in local var and cache listProperties globally.
				columnTypes = listProperties[ opt.listName ] = GetList(opt),
				//Default camlBehavior to ClientOM
				camlBehavior = opt.closeCaml || "ClientOM",
				//if array.length coerces to false, default to 1
				numOfQueries = opt.config.length || 1,
				filter,
				filters=[],
				fieldRef="",
				camlQuery = "",
				i=0,
				//Boolean for lookupId
				lookupId,
				normalizedNode = "";

			//console.log(numOfQueries);
			//debugger;

			if ( numOfQueries === 1 ) {
				//console.log("#ofQueries: " + numOfQueries);
				//debugger;
				for ( prop in opt.config ) {
					if ( opt.config.hasOwnProperty( prop ) ) {

						lookupId = opt.config[ prop ].hasOwnProperty("lookupId");
						normalizedNode = CorrectCAML( opt.config[ prop ].op );

						if ( normalizedNode === "IsNull" || normalizedNode === "IsNotNull" ) {
							camlQuery += wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName ) );
							//console.log("IsNull");
						} else {
							//columnTypes contains the field types
							camlQuery = wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName, lookupId ) + wrapValueType( columnTypes[ opt.config[ prop ].staticName ], opt.config[ prop ].value ) );
						}
					}
				}
			} else if ( numOfQueries === 2 ) {
				//console.log("#ofQueries: " + numOfQueries);
					for ( prop in opt.config ) {
						if ( opt.config.hasOwnProperty( prop ) ) {
							//Boolean result
							lookupId = opt.config[ prop ].lookupId === true;
							//Get correct CAML Node
							normalizedNode = CorrectCAML( opt.config[ prop ].op );

							//Get filter from first query
							if ( i === 0 ) {
								//console.log("Top Filter: " + i + " " + opt.config[prop].filter);
								filter = CorrectCAML( opt.config[ prop ].filter );
							}

							if ( normalizedNode === "IsNull" || normalizedNode === "IsNotNull" ) {
								camlQuery += wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName ) );
							} else {
								camlQuery += wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName, lookupId ) + wrapValueType( columnTypes[ opt.config[ prop ].staticName ], opt.config[ prop ].value ) );
							}
							i++;
						}
					}
				//Wrap with filter
				camlQuery = wrapNode( filter, camlQuery );
			} else if ( numOfQueries > 2) {
				//console.log("#ofQueries: " + numOfQueries);
				for ( prop in opt.config ) {
					if ( opt.config.hasOwnProperty(prop) ) {
						//Boolean result
						lookupId = opt.config[ prop ].lookupId === true;
						//Get correct CAML Node
						normalizedNode = CorrectCAML( opt.config[prop].op );

						//Push the filter into an Array
						if ( i !== ( numOfQueries -1 ) ) {
							//console.log("Filters for appendage: " + i + " " + opt.config[prop].filter);
							filters.push( CorrectCAML( opt.config[ prop ].filter) );
						}

						//Set up fieldRef based on parameters passed in
						if ( normalizedNode === "IsNull" || normalizedNode === "IsNotNull" ) {
							fieldRef = wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName ) );
						} else {
							fieldRef = wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName, lookupId ) + wrapValueType( columnTypes[ opt.config[ prop ].staticName ], opt.config[ prop ].value ) );
						}

						//Determine where to place the filter within the camlQuery
						if ( i <= 1 ) {
							//console.log(opt.config[prop].filter);
							camlQuery += "<" + CorrectCAML( opt.config[ prop ].filter ) + ">" + fieldRef;
						}
						//numOfQueries needs a -1 b/c i starts at 0...
						if ( i > 1 && i !== ( numOfQueries - 1) ) {
							camlQuery += "<" + CorrectCAML( opt.config[ prop ].filter) + ">" + fieldRef;
							//console.log("this ran: i !== numOfQueries.  i equals: " + i + " numOfQueries equals: " + numOfQueries);
						} else if ( i === ( numOfQueries - 1 ) ) {
							camlQuery += fieldRef;
							//console.log("ELSE: i !== numOfQueries.  i equals: " + i + " numOfQueries equals: " + numOfQueries);
						}
						//console.log(i + " " + numOfQueries + camlQuery);
						i++;
					}
				}
				//Append the filters from back to front
				i = filters.length;
				while( i-- ) {
					camlQuery += "</" + filters[ i ] + ">";
				}
			}

			if ( opt.hasOwnProperty("closeCaml") ) {
				if ( camlBehavior.toLowerCase() === "clientom" ) {
					//Wrap camlQuery with the correct tags <Query><Where>.
					camlQuery = CAML_TAG_QUERY_OPEN + CAML_TAG_WHERE_OPEN + camlQuery + CAML_TAG_WHERE_CLOSE + CAML_TAG_QUERY_CLOSE;
					//Add options that may have been passed in.
					camlQuery = this.AddCamlTags( opt, camlQuery );
					//Wrap camlQuery with <View> tags.
					return CAML_TAG_VIEW_OPEN + camlQuery + CAML_TAG_VIEW_CLOSE;
				}
				//Fallback to SPServices
				var orderTag = ( opt.hasOwnProperty("OrderBy") ) ? this.OrderBy( opt.OrderBy ) : "";

				return CAML_TAG_QUERY_OPEN +
								CAML_TAG_WHERE_OPEN +
									camlQuery +
								CAML_TAG_WHERE_CLOSE +
								orderTag +
							CAML_TAG_QUERY_CLOSE;
			}

			return camlQuery;
		},
		OrderBy: function( opt ) {
			var orderBy = "<OrderBy>";
			//console.log("OrderBy");

			for ( var prop in opt ) {
				if ( opt.hasOwnProperty( prop ) ) {
					orderBy += "<FieldRef Name='" + prop + "' Ascending='" + CorrectCAML( opt[ prop ] ) + "' />";
				}
			}

			return orderBy + "</OrderBy>";
		},
		QueryOptions: function( opt ) {
			var queryOptions = "<QueryOptions>";

			for ( var prop in opt ) {
				if ( opt.hasOwnProperty( prop ) ) {

					switch ( prop ) {
						case "IncludeMandatoryColumns":
						case "DateInUtc":
							queryOptions += wrapNode( prop, CorrectCAML( opt[ prop ] ) );
							break;

						case "Paging":
						case "Folder": //Should this value have a trailing "/" ?????
						case "RowLimit":
							queryOptions += wrapNode( prop, opt[ prop ] );
							break;

						case "ViewAttributes":
						case "Recursive":
							//http://msdn.microsoft.com/en-us/library/ie/dd585773(v=office.11).aspx
							queryOptions += "<ViewAttributes Scope='Recursive' />";
							break;
					}
				}
			}

			return queryOptions + "</QueryOptions>";
		},
		//Adds OrderBy, ViewFields, QueryOptions to CAML String
		AddCamlTags: function( opt, camlQuery ) {

			if ( opt.hasOwnProperty("ViewFields") ) {
				camlQuery = this.ViewFields( opt.ViewFields ) + camlQuery;
			}

			if ( opt.hasOwnProperty("OrderBy") ) {
				camlQuery += this.OrderBy( opt.OrderBy );
			}

			if ( opt.hasOwnProperty("QueryOptions") ) {
				camlQuery += this.QueryOptions( opt.QueryOptions );
			}

			return camlQuery;
		}
	};
})( jQuery );


/*******************************************************
//roboCAML
//
// Where to Learn CAML
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//	Query Schema Elements
//http://msdn.microsoft.com/en-us/library/ms467521.aspx
//	Query Managed Metadata Values
//http://msdn.microsoft.com/en-us/library/ff625182.aspx
//	Wikipedia
// http://en.wikipedia.org/wiki/Collaborative_Application_Markup_Language
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//	Things to implement
//~~Membership Element (Query)~~
//	http://msdn.microsoft.com/en-us/library/aa544234.aspx
//	~~Includes
//	http://msdn.microsoft.com/en-us/library/ff630172.aspx
//	~~NotIncludes
//	http://msdn.microsoft.com/en-us/library/ff630174.aspx
//  ~~In
//	http://msdn.microsoft.com/en-us/library/ff625761.aspx
//	~~DateRangesOverlap Element (Query)
//	http://msdn.microsoft.com/en-us/library/ms436080.aspx
//	~~DateRangesOverlap ~ Month
//	http://msdn.microsoft.com/en-us/library/ff625796.aspx


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//Code Optimization Sites:
//http://blogs.oracle.com/greimer/entry/best_way_to_code_a
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*****************************************************/

/****************************************************
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//roboCAML.ViewFields ~ Create ViewFields
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
****************************************************/
//This function accepts an array of fields as a parameter.  The returned value is valid CAML for use with Web Service calls.
//console.log( roboCAML.ViewFields(["SectionDDL", "Segment"]) );



/****************************************************
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//roboCAML.BatchCMD
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
****************************************************/
//roboCAML.BatchCMD for Deleting Items
//This function will create the text needed to Add/Update/Delete
/*
console.log(
	roboCAML.BatchCMD({

		//Mandatory parameter
		batchCMD: "Delete",

		//Mandatory parameter
		IDs: [1,2,3]
	})
);


//roboCAML.BatchCMD for creating New Items

console.log(
	roboCAML.BatchCMD({

		//Mandatory parameter
		batchCMD: "New",

		//Mandatory parameter
		valuePairs: [["JSPersonnelNameLookup", 1, "ModuleNotes", "ModuleNotes", "Description", "Googly Glop"], ["ListUID", 3]]  //Static Column Name, Value
	})
);
*/

//roboCAML.BatchCMD for Update
/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
***************************************************************************
// ~Recommended way to use BatchCMD with the Update option
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
***************************************************************************
console.log(
	roboCAML.BatchCMD({
		//batchCMD is optional ~ Update is the default value.
		//If batchCMD isn't set globally, it can be passed in individually for each method.

		//batchCMD: "Update",
		updates: [
			{
				//Static Column Name, Value
				valuePairs: ["Rank", "Numero Uno", "Description", "Some Notes", "Col3", "Update3", "ID", 1]
			},
			{
				//Defaults to Update anyway.  No need to pass it.
				batchCMD: "Update",
				valuePairs: ["ID", 2, "Col1", 1, "Col2", 2]
			},
			{
				batchCMD: "New",
				valuePairs: ["Col1", 1, "Col2", 2]
			},
			{
				batchCMD: "Delete",
				ID: 3
			}
		]
	})
);
*/


/*
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// ~This portion is deprecated and will be pulled from roboCAML at any given time.
// ~IDs and valuePairs must be in the same order or you'll kill KITTENS!!!!
// ~You can use this way as well, but I don't think it's as easy to follow and may
// ~cause unintended consequences.  Use with caution!
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
/*

console.log(
	roboCAML.BatchCMD({
		batchCMD: "Update",
		IDs: [1,2,3],
		valuePairs: [["Rank", "Numero Uno", "Description", "Some Notes", "Col3", "Update3"], ["Col1", "1"], ["Col1", 1, "Col2", 2]] //Static Column Name, Value
	})
);
*/

/*
To programatically build the CAML call, use arrays
var arrValuePairs = [];
var arrIDs = [];

$('#MyTable tr').each(function(index) {
	var values = stripHTML($(this).html()).split("|");

	if ( parseInt(values[2]) !== (index + 1) ) {
		//Push an Array into arrValuePairs
		arrValuePairs.push( ["MatrixRank", (index+1), "Description", "Some Notes"] );
		//Increment arrIDs' index and store the value
		arrIDs[arrIDs.length++] = parseInt( values[1] );
	}
});

console.log(
	roboCAML.BatchCMD({
		batchCMD: "Update",

		//For IDs, just add the array as is
		IDs: arrIDs,

		//For valuePairs, wrap your prebuilt array in an array
		// ex: [ [StaticColumnName, Value], [OtherStaticColumn, Value] ]
		valuePairs: [arrValuePairs]

	})
);
*/



/*
var titleColumnValue = 1;
roboCAML.BatchCMD({
	//Mandatory parameter
	batchCMD: "New",
	//Mandatory parameter
	valuePairs: [	//Static Column Name, Value
							["ContentType", "Folder with Category", "BaseName", titleColumnValue, "Initiative_Name", titleColumnValue, "Document_x0020_Category", "BASE"],
							["ContentType", "Folder with Category", "BaseName", titleColumnValue + "/Base Plan_FCR_IFS", "Initiative_Name", titleColumnValue, "Document_x0020_Category", "Base Plan_FCR_IFS"],
							["ContentType", "Folder with Category", "BaseName", titleColumnValue + "/CPS_Accelerator Report", "Initiative_Name", titleColumnValue, "Document_x0020_Category", "CPS_Accelerator Report"],
							["ContentType", "Folder with Category", "BaseName", titleColumnValue + "/GTRO_Technical Risk Assessment", "Initiative_Name", titleColumnValue, "Document_x0020_Category", "GTRO_Technical Risk Assessment"],
							["ContentType", "Folder with Category", "BaseName", titleColumnValue + "/Initiative Announcements_Post Launch Tracking", "Initiative_Name", titleColumnValue, "Document_x0020_Category", "Initiative Announcements_Post Launch Tracking"],
							["ContentType", "Folder with Category", "BaseName", titleColumnValue + "/Pre-TTR_TTR_Toolbox", "Initiative_Name", titleColumnValue, "Document_x0020_Category", "Pre-TTR_TTR_Toolbox"],
							["ContentType", "Folder with Category", "BaseName", titleColumnValue + "/Decision Sheets_Change Management_PACE", "Initiative_Name", titleColumnValue, "Document_x0020_Category", "Decision Sheets_Change Management_PACE"],
							["ContentType", "Folder with Category", "BaseName", titleColumnValue + "/Project Knowledge", "Initiative_Name", titleColumnValue, "Document_x0020_Category", "Project Knowledge"],
							["ContentType", "Folder with Category", "BaseName", titleColumnValue + "/SIMPL Working Documents", "Initiative_Name", titleColumnValue, "Document_x0020_Category", "SIMPL Working Documents"],
							["ContentType", "Folder with Category", "BaseName", titleColumnValue + "/Meeting Notes_Key Project Events", "Initiative_Name", titleColumnValue, "Document_x0020_Category", "Meeting Notes_Key Project Events"],
							["ContentType", "Folder with Category", "BaseName", titleColumnValue + "/Consumer_Technical Research", "Initiative_Name", titleColumnValue, "Document_x0020_Category", "Consumer_Technical Research"],
							["ContentType", "Folder with Category", "BaseName", titleColumnValue + "/Marketing Concept_ZMOT_FMOT_SMOT", "Initiative_Name", titleColumnValue, "Document_x0020_Category", "Marketing Concept_ZMOT_FMOT_SMOT"]
						]
});


*/



/****************************************************
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//roboCAML.Query ~ Your very own U2U in JavaScript *** YAY!!! ***
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
****************************************************/

/*
console.log(
	roboCAML.Query({

		//optional
		//webURL: "http://YourURL",

		//Mandatory
		listName: "Bid Key",

		//Optional
		OrderBy: ["Title", "True"],

		//Mandatory
		config: [
			{
				//Conditionally Mandatory; see below
				filter: "Or",

				//Mandatory
				op: "IsNotNull",

				//Mandatory
				staticName: "HireModuleNotes",

				//Conditionally Mandatory, IsNull and IsNotNull do not require a value.
				value: "Some Comments"
			},
			{
				filter: "||",
				op: "=",
				staticName: "ID",
				value: 14,

				//LookupId is an optional parameter
				LookupId: true
			},
			{
				filter: "&&",
				op: ">=",
				staticName: "Title",
				value: "Title Text"
			},
			{
				//Notice, the last query does not need filter.  The code will ignore it even if you pass it in.
				op: "Eq",
				staticName: "owshiddenversion",
				value: 100
			}
		]
	})
);
*/
/*
console.log(
	roboCAML.Query({
		//optional
		//webURL: "http://YourURL",
		//Mandatory
		listName: "POS Descriptions",
		//Mandatory
		config: [
			{
				//Mandatory
				op: "!=",

				//Mandatory
				staticName: "ID",

				//Conditionally Mandatory, IsNull and IsNotNull do not require a value.
				value: 0
			}
		]
	})
);
*/


//For dynamic calls, build up an array for config.  This syntax is valid:
/*
var array = [];
array.push(
	{
		filter: "Or",
		op: "Neq",
		staticName: "JSBidHireModuleNotes",
		value: "Some Comments"
	},
	{
		filter: "Or",
		op: "Eq",
		staticName: "ID",
		value: 14,
		LookupId: true
	}
);
*/
/*
console.log(
	roboCAML.Query({
		//webURL: "http://YourURL",
		listName: "Bid Key",
		config: array
	})
);
*/

/****************************************************
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//roboCAML.OrderBy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
****************************************************/
//Property names equal Static Names...
//You must provide True or False for Ascending
/*
console.log(
	roboCAML.OrderBy({
		ID: true,
		MultiSelectLookup: false
	})
);
*/