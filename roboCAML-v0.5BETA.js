/*
 * roboCAML - Dynamically create CAML client side
 * Version 0.5
 * @requires jQuery
 *
 * Copyright 2011, Matthew P. Bramer
 * Examples and docs at:
 * http://roboCAML.codeplex.com
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */
/**
 * @name roboCAML
 * @category Module/roboCAML
 * @author Matthew P. Bramer/matthewpaulbramer@hotmail.com
 *
 *	Break/fix
 *	~ Fixed Issue 756: http://robocaml.codeplex.com/workitem/756
 *	~ Postponed Issue 921: http://robocaml.codeplex.com/workitem/921 ~ stripped list caching from codebase for now...  Need more time to implement a long term solution.
 *	~ House cleaning on some duplicated/hardcoded text values. Converted them to variables.
 */
var roboCAML = (function( $ ) {

	//Globals
	var SOAPEnvelope = {
			header: "<soap:Envelope xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:soap='http://schemas.xmlsoap.org/soap/envelope/'><soap:Body>",
			footer: "</soap:Body></soap:Envelope>"
		},
		INVALID_CAML = "<INVALID CAML />",
		//Used to prevent CAML string from being too long and choking the query. Will fallback to this query when I find out the maximum length a query can be.
		DEFAULT_CAML = "<Where><Neq><FieldRef Name='ID' /><Value Type='Counter'>0</Value></Neq></Where>",
		CAML_TAG_VIEW_OPEN = "<View>",
		//If only files are needed add: <Eq><FieldRef Name='FSObjType' /><Value Type='Lookup'>0</Value></Eq> to query.
		//Wont fix: All options for <View Scope=*>. 1 is good enough.
		CAML_TAG_VIEW_RECURSIVE_ALL_OPEN = "<View Scope='RecursiveAll'>",
		CAML_TAG_VIEW_CLOSE = "</View>",
		CAML_TAG_QUERY_OPEN = "<Query>",
		CAML_TAG_QUERY_CLOSE = "</Query>",
		CAML_TAG_WHERE_OPEN = "<Where>",
		CAML_TAG_WHERE_CLOSE = "</Where>",
		//Used to cache the siteURL for the GetList Web Service call.
		thisSite = "",
		//Used to cache the list properties that have been queried.
		listProperties = {},
		//Used in QueryOptions to modify <View>
		recursive = false,

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
		
/*
			//Researching the best way to cache the list schema...  
			
			
			debugger;
			//Return listProperties if already cached.
			if ( listProperties[ opt.listName ] ) {
				//console.log( "returning cached results");
				//console.dir( listProperties[ opt.listName] );
				return listProperties[ opt.listName ];
			}
*/

			//Object to be returned w/ list information
			var returnProps = {},
				// Build the URL for the Ajax call based on which operation we're calling
				// If the webURL has been provided, then use it, else use the current site
				ajaxURL = "_vti_bin/Lists.asmx";

			if ( opt.hasOwnProperty("webURL") ) {
				if ( opt.webURL.charAt( opt.webURL.length - 1 ) === "/" ) {
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
					"<WebUrlFromPageUrl xmlns='http://schemas.microsoft.com/sharepoint/soap/'><pageUrl>" +
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
		correctCAML = function ( node ) {
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

		/* ~~~~~~~ QueryOptions portion ~~~~~~~~ */
					case "dateinutc":
						return "DateInUtc";

					case "folder":
						return "Folder";

					case "includemandatorycolumns":
						return "IncludeMandatoryColumns";

					case "listitemcollectionpositionnext":
						return "ListItemCollectionPositionNext";

					case "meetinginstanceid":
					case "meetingid":
						return "MeetingInstanceID";

					case "paging":
						return "Paging";

					case "rowlimit":
						return "RowLimit";

					case "viewattributes":
					case "recursive":
						return "ViewAttributes";

		/* ~~~~~~~ BatchCMD portion ~~~~~~~~ */
					case "update":
						return "Update";
					case "delete":
						return "Delete";
					case "new":
						return "New";

		/* ~~~~~~~ Misc portion ~~~~~~~~ */
					case "true":
						return "True";
					case "false":
						return "False";
				}
			}
		};	//End of correctCAML


	//Begin roboCAML methods
	return {
		BatchCMD: function( opt ) {
			//Cache array.length
			var loopLength,
				//Begin batch string
				batch = "<Batch OnError='Continue'>",
				batchClose = "</Batch>",
				methodOpen = "<Method ID='",
				methodClose = "</Method>",
				//Store the array.length within the array that's passed in
				fieldNum,
				/*  These vars may cause issues w/ being cached.  Verify when testing */
				i,
				fieldNames;

			//Default to update ~ needed this to allow a mixed batchCMD to be created
			opt.batchCMD =  ( opt.batchCMD ) ? correctCAML( opt.batchCMD ) : "Update";

			switch ( opt.batchCMD.toLowerCase() ) {
				case "delete":
					loopLength = opt.IDs.length;
					while ( loopLength-- ) {
						batch += methodOpen + ( loopLength + 1 ) + "' Cmd='" + opt.batchCMD + "'><Field Name='ID'>" + opt.IDs[ loopLength ] + "</Field>" + methodClose;
					}
					batch += batchClose;

					return batch;

				case "new":
					//console.log(opt.valuePairs.length);
					loopLength = opt.valuePairs.length;

					for ( i=0; i < loopLength; i++ ) {
						//console.log(opt.valuePairs[i].length);
						batch += methodOpen + ( i + 1 ) + "' Cmd='" + opt.batchCMD + "'>";
						fieldNum = opt.valuePairs[ i ].length;

						for ( fieldNames=0; fieldNames < fieldNum; fieldNames = fieldNames+2 ) {
							batch += "<Field Name='" + opt.valuePairs[ i ][ fieldNames ] + "'>" + opt.valuePairs[ i ][ ( fieldNames + 1 ) ] + "</Field>";
							//console.log(batch);
						}
						batch += methodClose;
					}
					
					batch += batchClose;
					return batch;

				//Defaults to update to facilitate updates that can contain all of the options: New, Delete, & Update
				//case "update":
				default:
					//console.log("updates length: " + opt.updates.length);

					loopLength = opt.updates ? opt.updates.length : opt.IDs.length;

					if ( opt.hasOwnProperty( "IDs" ) ) {
						for ( i=0; i<loopLength; i++ ) {
							//console.log(opt.valuePairs[i].length);
							batch += methodOpen + ( i + 1 ) + "' Cmd='" + opt.batchCMD + "'>";

							for ( fieldNames=0, fieldNum = opt.valuePairs[ i ].length; fieldNames < fieldNum; fieldNames = fieldNames + 2 ) {
								batch += "<Field Name='" + opt.valuePairs[ i ][ fieldNames ] + "'>" + opt.valuePairs[ i ][ ( fieldNames + 1 ) ] + "</Field>";
								//console.log(batch);
							}
							//Get ID from opt.IDs
							batch += "<Field Name='ID'>" + opt.IDs[ i ] + "</Field>" + methodClose;
						}
					} else {
						for ( i=0; i < loopLength; i++ ) {
							//console.dir(opt.valuePairs[i].length);

							//Caches current object that's being enumerated.
							var currObj = opt.updates[ i ],

								//Allows a Cmd to be passed within the object or defaults to the global option: batchCMD.
								crudOp = ( currObj.batchCMD ) ? correctCAML( currObj.batchCMD ) : opt.batchCMD;

							//console.dir( currObj.valuePairs.length );

							//Open <Method>
							batch += methodOpen + ( i + 1 ) + "' Cmd='" + crudOp + "'>";

							if ( crudOp === "Delete" ) {
								batch += "<Field Name='ID'>" + currObj.ID + "</Field>";
							} else {
								for ( fieldNames=0, fieldNum = currObj.valuePairs.length; fieldNames < fieldNum; fieldNames = fieldNames + 2 ) {
									//debugger;
									batch += "<Field Name='" + currObj.valuePairs[ fieldNames ] + "'>" + currObj.valuePairs[ ( fieldNames + 1 ) ] + "</Field>";
									//console.log(batch);
								}
							}

							//Close </Method>
							batch += methodClose;
							//Get ID from opt.IDs
							//batch += "<Field Name='ID'>" + currObj.ID + "</Field></Method>";
						}
					}
					
					batch += batchClose;
					return batch;
			}
		},
		OrderBy: function( opt ) {
			var orderBy = "<OrderBy>";
			//console.log("OrderBy");

			for ( var prop in opt ) {
				if ( opt.hasOwnProperty( prop ) ) {
					orderBy += "<FieldRef Name='" + prop + "' Ascending='" + correctCAML( opt[ prop ] ) + "' />";
				}
			}

			return orderBy + "</OrderBy>";
		},
		Query: function( opt ) {
			var prop,
				//Store listProperties in local var and cache listProperties globally.
				//columnTypes = listProperties[ opt.listName ] = GetList( opt ),
				
				//Delete after fixing list cache issue...
				columnTypes = GetList( opt ),
				//Default camlBehavior to ClientOM
				camlBehavior = ( opt.closeCaml ) ? opt.closeCaml.toLowerCase() : "clientom",
				//if array.length coerces to false, default to 1
				numOfQueries = opt.config.length || 1,
				filter,
				filters = [],
				fieldRef = "",
				camlQuery = "",
				i=0,
				//Boolean for lookupId
				lookupId = false,
				//Boolean test for fragment being passed in.
				camlFragment = false,
				normalizedNode = "",
				//<OrderBy>
				orderTag = ( opt.hasOwnProperty("OrderBy") ) ? this.OrderBy( opt.OrderBy ) : "";

			//console.log(numOfQueries);
			//debugger;

			if ( numOfQueries === 1 ) {
				//console.log("#ofQueries: " + numOfQueries);
				//debugger;
				for ( prop in opt.config ) {
					if ( opt.config.hasOwnProperty( prop ) ) {
						//Boolean result
						lookupId = opt.config[ prop ].lookupId === true;
						normalizedNode = correctCAML( opt.config[ prop ].op );

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
							//Sets camlFragment to true if a string of CAML has been passed in.
							camlFragment = typeof opt.config[ prop ].camlFragment === "string";
							//Get correct CAML Node.
							normalizedNode = ( camlFragment ) ?
								opt.config[ prop ].camlFragment :
								correctCAML( opt.config[ prop ].op )
							; //vars

							//Get filter from first query
							if ( i === 0 ) {
								//console.log("Top Filter: " + i + " " + opt.config[prop].filter);
								filter = correctCAML( opt.config[ prop ].filter );
							}
							
							
							//Set up fieldRef based on parameters passed in
							if ( normalizedNode === "IsNull" || normalizedNode === "IsNotNull" ) {
								camlQuery += wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName ) );
							} else if ( camlFragment ) {
								camlQuery += normalizedNode;
							} else {
								camlQuery += wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName, lookupId ) + wrapValueType( columnTypes[ opt.config[ prop ].staticName ], opt.config[ prop ].value ) );
							}
						
/*						
							if ( normalizedNode === "IsNull" || normalizedNode === "IsNotNull" ) {
								camlQuery += wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName ) );
							} else {
								camlQuery += wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName, lookupId ) + wrapValueType( columnTypes[ opt.config[ prop ].staticName ], opt.config[ prop ].value ) );
							}
*/
							
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
						//Sets camlFragment to true if a string of CAML has been passed in.
						camlFragment = typeof opt.config[ prop ].camlFragment === "string";
						//Get correct CAML Node.
						normalizedNode = ( camlFragment ) ?
							opt.config[ prop ].camlFragment :
							correctCAML( opt.config[ prop ].op )
						; //vars

						//Push the filter into an Array
						if ( i !== ( numOfQueries -1 ) ) {
							//console.log("Filters for appendage: " + i + " " + opt.config[prop].filter);
							filters.push( correctCAML( opt.config[ prop ].filter) );
						}

						//Set up fieldRef based on parameters passed in
						if ( normalizedNode === "IsNull" || normalizedNode === "IsNotNull" ) {
							fieldRef = wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName ) );
						} else if ( camlFragment ) {
							fieldRef = normalizedNode;
						} else {
							fieldRef = wrapNode( normalizedNode, wrapFieldRef( opt.config[ prop ].staticName, lookupId ) + wrapValueType( columnTypes[ opt.config[ prop ].staticName ], opt.config[ prop ].value ) );
						}

						//Determine where to place the filter within the camlQuery
						if ( i <= 1 ) {
							//console.log(opt.config[prop].filter);
							camlQuery += "<" + correctCAML( opt.config[ prop ].filter ) + ">" + fieldRef;
						}
						//numOfQueries needs a -1 b/c i starts at 0...
						if ( i > 1 && i !== ( numOfQueries - 1) ) {
							camlQuery += "<" + correctCAML( opt.config[ prop ].filter) + ">" + fieldRef;
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

			//Close off camlQuery with proper tags.
			if ( opt.hasOwnProperty("closeCaml") ) {
				//Wrap camlQuery with the correct tags <Query><Where>.
				camlQuery = 	CAML_TAG_QUERY_OPEN +
											CAML_TAG_WHERE_OPEN +
												camlQuery +
											CAML_TAG_WHERE_CLOSE +
											orderTag +
										CAML_TAG_QUERY_CLOSE;
			
				if ( camlBehavior === "clientom" ) {
					//Add options that may have been passed in.
					//<ViewFields>
					if ( opt.hasOwnProperty("ViewFields") ) {
						camlQuery = this.ViewFields( opt.ViewFields ) + camlQuery;
					}
					//<QueryOptions>
					if ( opt.hasOwnProperty("QueryOptions") ) {
						//pass in opt, so QueryOptions can determine what type of query to work with.
						camlQuery += this.QueryOptions( opt, true );
					}

					//Wrap camlQuery with <View> tags.
					if ( recursive ) {
						recursive = false;
						return CAML_TAG_VIEW_RECURSIVE_ALL_OPEN + camlQuery + CAML_TAG_VIEW_CLOSE;
					}
					return CAML_TAG_VIEW_OPEN + camlQuery + CAML_TAG_VIEW_CLOSE;
				}

				//Fallback to SPServices
				return camlQuery;
			}

			//Return CAML fragment.
			return camlQuery;
		},
		QueryOptions: function( opt, internalUsage ) {
			//More options need implementation: http://msdn.microsoft.com/en-us/library/dd586530(v=office.11).aspx
			//Default assumes a CAML fragment is needed for SPServices. This also facilitates the need for Folder querying within ClientOM.
			
			/********************************************************
				//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
					// ~Example usage
					//	roboCAML.QueryOptions({
					//		IncludeMandatoryColumns: true,
					//		Folder: "/siteName/Lists/GrandChild/TestFolder/TestSubFolder"
					//	});
				//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
			*******************************************************/

			var camlBehavior = opt.closeCaml || "spservices",
				spservices = camlBehavior.toLowerCase() === "spservices",
				queryOptions = "";

			if ( spservices ) {
				queryOptions =  "<QueryOptions>";
			}

			//Needed so closeCaml can be read from the options when interacting with ClientOM.
			if ( internalUsage ) {
				opt = opt.QueryOptions;
			}

			for ( var prop in opt ) {
				if ( opt.hasOwnProperty( prop ) ) {
					//Cache original value to  access the property later.
					var _prop = prop;

					prop = correctCAML( prop );

					switch ( prop ) {
						case "IncludeMandatoryColumns":
						case "DateInUtc":
							queryOptions += wrapNode( prop, correctCAML( opt[ _prop ] ) );
							break;

						case "MeetingInstanceID":
						case "Paging":
						case "RowLimit":
						case "Folder": //Should this value have a trailing "/" ????? <---- Doesn't matter. :~)
						//Folder should contain: /URL/ListName/TopLevelFolder/SubFolder <--- SPServices only.
						//For Client OM, refer to this thread: http://social.technet.microsoft.com/Forums/en-CA/sharepoint2010programming/thread/b9297b3e-8c39-4fef-82dc-fec04b9774c0
							
							//RowLimit gets no love with SPServices. It's passed in completely different.
							if ( prop !== "RowLimit" && toType( opt[ _prop ] ) === "number" || toType( opt[ _prop ] ) === "string" ) {
								
								if ( spservices ) {
									queryOptions += wrapNode( prop, opt[ _prop ] );
								} else {
									queryOptions = wrapNode( prop, opt[ _prop ] ) + queryOptions;
								}
							} else if ( toType( opt[ _prop ] ) === "object" ) {
								//Figure out how to variablize ListItemCollectionPositionNext for compatibility with correctCAML().
								//var ListItemCollectionPositionNext = <----- Will not fix.  I'd have to add another loop and I'm not interested in that.
								queryOptions += "<" + prop + " ListItemCollectionPositionNext='" + opt[ _prop ].ListItemCollectionPositionNext + "' />";
							}

							break;

						case "ViewAttributes":
							//http://msdn.microsoft.com/en-us/library/ie/dd585773(v=office.11).aspx							
							if ( spservices ) {
								queryOptions += "<ViewAttributes Scope='RecursiveAll' />";
							} else if ( opt[ _prop ] ) {
								recursive = true;
							}
							break;
					} //end switch
				}
			}

			if ( spservices ) {
				return queryOptions + "</QueryOptions>";
			}

			return queryOptions;
		},
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
// ~~Projected Fields/Joins
//	http://social.technet.microsoft.com/Forums/en-US/sharepoint2010programming/thread/487d344c-3373-4540-b190-5a20ba06ec24/
//	http://rmanimaran.wordpress.com/2011/03/11/new-in-sharepoint-2010-caml-query/ <--- Investigate
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

*****************************************************/