/*
 * roboCAML - Dynamically create CAML client side
 * Version 0.1
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
 * @category Plugins/roboCAML
 * @author Matthew P. Bramer/matthewpaulbramer@hotmail.com
 */
var roboCAML = (function($) {	
	return {
		ViewFields: function(arr) {
			var camlViewFields = "";
			
			if ( typeof arr !== "undefined" && arr.length ) {
				var loopLength = arr.length;
				//console.log(loopLength);
				camlViewFields = "<ViewFields>";
				//Using a while loop b/c it's the fastest loop and the order of ViewFields doesn't matter
				while (loopLength--) {
					//console.log(arr[loopLength]);
					camlViewFields += "<FieldRef Name='" + arr[loopLength] + "' />";
				}
				camlViewFields += "</ViewFields>";
				return camlViewFields;
			}
		},
		BatchCMD: function(opt) {
			var fieldNum, batch = "<Batch OnError='Continue'>", loopLength;

			switch ( opt.batchCMD ) {
				case "Delete":
					loopLength = opt.IDs.length;
					while ( loopLength-- ) {
						batch += "<Method ID='" + ( loopLength + 1 ) + "' Cmd='" + opt.batchCMD + "'><Field Name='ID'>" + opt.IDs[loopLength] + "</Field></Method>";
					}
					batch += "</Batch>";
					return batch;
					
				case "New":
					//console.log(opt.valuePairs.length);
					loopLength = opt.valuePairs.length;
					
					for (i=0; i<loopLength; i++) {
						//console.log(opt.valuePairs[i].length);
						batch += "<Method ID='" + (i+1) + "' Cmd='" + opt.batchCMD + "'>";
						fieldNum = opt.valuePairs[i].length;

						for (fieldNames=0; fieldNames < fieldNum; fieldNames = fieldNames+2) {
							batch += "<Field Name='" + opt.valuePairs[i][fieldNames] + "'>" + opt.valuePairs[i][ (fieldNames+1) ] + "</Field>";
							//console.log(batch);
						}
						batch += "</Method>";
					}
					batch += "</Batch>";
					return batch;

				case "Update":
					//console.log(opt.valuePairs.length);
					loopLength = opt.valuePairs.length;
					
					for (i=0; i<loopLength; i++) {
						//console.log(opt.valuePairs[i].length);
						batch += "<Method ID='" + (i+1) + "' Cmd='" + opt.batchCMD + "'>";
						fieldNum = opt.valuePairs[i].length;

						for (fieldNames=0; fieldNames < fieldNum; fieldNames = fieldNames+2) {
							batch += "<Field Name='" + opt.valuePairs[i][fieldNames] + "'>" + opt.valuePairs[i][ (fieldNames+1) ] + "</Field>";
							//console.log(batch);
						}
						batch += "<Field Name='ID'>" + opt.IDs[i] + "</Field></Method>";
					}
					batch += "</Batch>";
					return batch;

				default:
					break;
			}
		},
		Query: function(opt) {
			var SOAPEnvelope = {};
			SOAPEnvelope.header = "<soap:Envelope xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:soap='http://schemas.xmlsoap.org/soap/envelope/'><soap:Body>";
			SOAPEnvelope.footer = "</soap:Body></soap:Envelope>";

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
			//Util functions
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
			//Wrap FieldRef ~ Figure this out later
			function wrapFieldRef(v) {
				return "<FieldRef Name='" + v + " />";
			}
			//Get List Properties
			function GetList(opt) {
				//Object to be returned w/ list information
				var listProperties = {};
				// Build the URL for the Ajax call based on which operation we're calling
				// If the webURL has been provided, then use it, else use the current site
				var ajaxURL = "_vti_bin/Lists.asmx";
				if ( opt.hasOwnProperty("webURL") ) {
					if ( opt.webURL.charAt(opt.webURL.length - 1 ) === "/") {
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
						$(xData.responseXML).find("Fields > Field").each(function() {
							//console.log( "Type: " + $(this).attr("Type") + " StaticName: " + $(this).attr("StaticName") );
							listProperties[$(this).attr("StaticName")] = $(this).attr("Type");
						});
					}
				});
				return listProperties;
			}

			function GetWeb() {
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
			} //End of GetWeb
			
			function CorrectCAML(node) {
				switch( node.toUpperCase() ) {
					//Function will return correct CAML values that are passed into roboCAML.Query
					//Eq, Neq, Gt, Geq, Lt, Leq, IsNull, IsNotNull, BeginsWith, Contains, DateRangesOverlap
					
/* ~~~~~~~ Filter portion ~~~~~~~ */
					//And
					case "&&":
					case "&":
					case "AND":
						return "And";
						//break;
					//Or
					case "||":
					case "OR":
						return "Or";
						//break;
/* ~~~~~~~ Ops portion ~~~~~~~~ */
					case "EQUAL":
					case "EQUALS":
					case "=":
					case "EQ":
						return "Eq";
						//break;
					//Not Equals
					case "NEQ":
					case "NOT EQUAL":
					case "NOT EQUALS":
					case "!=":
						return "Neq";
						//break;
					//Greater than
					case "GT":
					case ">":
						return "Gt";
						//break;
					//Greater than or equal to
					case "GEQ":
					case ">=":
						return "Geq";
						//break;
					//Less than
					case "LT":
					case "<":
						return "Lt";
						//break;
					//Less than or equal to
					case "LEQ":
					case "<=":
						return "Leq";
						//break;
					//IsNull
					case "ISNULL":
					case "NULL":
						return "IsNull";
						//break;
					//IsNotNull
					case "ISNOTNULL":
					case "NOT NULL":
						return "IsNotNull";
						//break;
					//BeginsWith
					case "BEGINSWITH":
					case "BEGINS WITH":
					case "STARTSWITH":
					case "STARTS WITH":
						return "BeginsWith";
						//break;
					//Contains
					case "CONTAINS":
					case "*":
						return "Contains";
						//break;
					//DateRangesOverlap
					case "DATERANGESOVERLAP":
						return "DateRangesOverlap";
						//break;
				}
			} //End of NormalizeOp

			//Query list for column properties
			//console.log(opt.webURL + " " + opt.listName);
			
			//Set variables
			var listProperties = GetList(opt), numOfQueries = opt.config.length || 1, filter, filters=[], fieldRef="", camlQuery = "", i=0, normalizedNode = "";

			//console.log(numOfQueries);
			//debugger;
			
			if ( numOfQueries === 1 ) {
				//console.log("#ofQueries: " + numOfQueries);
				for ( prop in opt.config ) {
					//Get correct CAML Node
					normalizedNode = CorrectCAML(opt.config[prop].op);
					
					if ( normalizedNode === "IsNull" || normalizedNode === "IsNotNull" ) {
						camlQuery += roboCAML.wrapNode( normalizedNode, "<FieldRef Name='" + opt.config[prop].staticName + "' />" );
						//console.log("IsNull");
					} else if ( opt.config[prop].hasOwnProperty("LookupId") ) {
																																																																	//listProperties contains the field types
						camlQuery = roboCAML.wrapNode(normalizedNode, "<FieldRef Name='" + opt.config[prop].staticName + "' LookupId='True' /><Value Type='" + listProperties[opt.config[prop].staticName] +
						"'>" + opt.config[prop].value + "</Value>");
					} else {
						camlQuery = roboCAML.wrapNode(normalizedNode, "<FieldRef Name='" + opt.config[prop].staticName + "' /><Value Type='" + listProperties[opt.config[prop].staticName] +
						"'>" + opt.config[prop].value + "</Value>");		
						//console.log("Else ran ===1");
					}
				}
			} else if ( numOfQueries === 2) {
				//console.log("#ofQueries: " + numOfQueries);
					for ( prop in opt.config ) {
						//Get correct CAML Node
						normalizedNode = CorrectCAML(opt.config[prop].op);
						
						//Get filter from first query
						if ( i === 0 ) {
							//console.log("Top Filter: " + i + " " + opt.config[prop].filter);
							filter = CorrectCAML(opt.config[prop].filter);
						}
						
						if ( normalizedNode === "IsNull" || normalizedNode === "IsNotNull" ) {
							camlQuery += roboCAML.wrapNode( normalizedNode, "<FieldRef Name='" + opt.config[prop].staticName + "' />" );
						} else if ( opt.config[prop].hasOwnProperty("LookupId") ) {
																																																																			//listProperties contains the field types
							camlQuery += roboCAML.wrapNode( normalizedNode, "<FieldRef Name='" + opt.config[prop].staticName + "' LookupId='True' /><Value Type='" + listProperties[opt.config[prop].staticName] +
							"'>" + opt.config[prop].value + "</Value>");
						} else {
							camlQuery += roboCAML.wrapNode( normalizedNode, "<FieldRef Name='" + opt.config[prop].staticName + "' /><Value Type='" + listProperties[opt.config[prop].staticName] +
							"'>" + opt.config[prop].value + "</Value>");
						}
						i++;
					}
				//Wrap with filter
				camlQuery = roboCAML.wrapNode( filter, camlQuery );
			} else if ( numOfQueries > 2) {
				//console.log("#ofQueries: " + numOfQueries);
				for ( prop in opt.config ) {
					//Get correct CAML Node
					normalizedNode = CorrectCAML(opt.config[prop].op);
					
					//Push the filter into an Array
					if (i !== (numOfQueries -1) ) {
						//console.log("Filters for appendage: " + i + " " + opt.config[prop].filter);
						filters.push( CorrectCAML(opt.config[prop].filter) );
					}
					
					//Set up fieldRef based on parameters passed in
					if ( normalizedNode === "IsNull" || normalizedNode === "IsNotNull" ) {
						fieldRef = roboCAML.wrapNode( normalizedNode,  "<FieldRef Name='" + opt.config[prop].staticName + "' />" );
					} else if ( opt.config[prop].hasOwnProperty("LookupId") ) {
																																																																//listProperties contains the field types
						fieldRef = roboCAML.wrapNode(normalizedNode,  "<FieldRef Name='" + opt.config[prop].staticName + "' LookupId='True' /><Value Type='" + listProperties[opt.config[prop].staticName] +
						"'>" + opt.config[prop].value + "</Value>");
					} else {
						fieldRef = roboCAML.wrapNode(normalizedNode,  "<FieldRef Name='" + opt.config[prop].staticName + "' /><Value Type='" + listProperties[opt.config[prop].staticName] +
						"'>" + opt.config[prop].value + "</Value>");
					}
					
					//Determine where to place the filter within the camlQuery
					if ( i <= 1 ) {
						//console.log(opt.config[prop].filter);
						camlQuery += "<" + CorrectCAML(opt.config[prop].filter) + ">" + fieldRef;
					}
					//numOfQueries needs a -1 b/c i starts at 0...
					if ( i > 1 && i !== (numOfQueries-1) ) {
						camlQuery += "<" + CorrectCAML(opt.config[prop].filter) + ">" + fieldRef;
						//console.log("this ran: i !== numOfQueries.  i equals: " + i + " numOfQueries equals: " + numOfQueries);
					} else if ( i === (numOfQueries-1) ) {
						camlQuery += fieldRef;
						//console.log("ELSE: i !== numOfQueries.  i equals: " + i + " numOfQueries equals: " + numOfQueries);
					}
					//console.log(i + " " + numOfQueries + camlQuery);
					i++;
				}
				//Append the filters from back to front
				i = filters.length;
				while(i--) {
					camlQuery += "</" + filters[i] + ">";
				}
				/*
					//Wrap closing tags
					camlQuery = wrapNode("Where", camlQuery);
					if ( opt.hasOwnProperty("OrderBy") ) {
						camlQuery += roboCAML.OrderBy(opt.OrderBy);
					}
					camlQuery = wrapNode("Query", camlQuery);
				*/
			}
			return camlQuery;
		},
		wrapNode: function wrapNode(n, v) {
				// Wrap an XML node (n) around a value (v)
				return "<" + n + ">" + v + "</" + n + ">";
		},
		OrderBy: function(arr) {
			var orderBy;
			//console.log("OrderBy");

			if ( typeof arr !== "undefined" && arr.length ) {
					var i=0, loopLength = arr.length;
					//console.log(loopLength);
					orderBy = "<OrderBy>";
					while (i<loopLength) {
						//console.log(arr[i]);
						orderBy += "<FieldRef Name='" + arr[i] + "' Ascending='" + arr[ ( i+1 ) ] + "'/>";
						i = i+2;
					}
					orderBy += "</OrderBy>";
					return orderBy;
			}
		}
	};
})(jQuery);


/*******************************************************
//roboCAML
//
//How To Learn CAML
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
//	http://msdn.microsoft.com/en-us/library/aa544234.aspx
//	Includes
//	http://msdn.microsoft.com/en-us/library/ff630172.aspx
//	NotIncludes
//	http://msdn.microsoft.com/en-us/library/ff630174.aspx
// In
//	http://msdn.microsoft.com/en-us/library/ff625761.aspx
//	Membership Type
//	http://msdn.microsoft.com/en-us/library/aa544234.aspx
//	DateRangesOverlap ~ Month
//	http://msdn.microsoft.com/en-us/library/ff625796.aspx
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//Code Optimization Sites:
//http://blogs.oracle.com/greimer/entry/best_way_to_code_a
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*****************************************************/

//roboCAML.ViewFields ~ Create ViewFields
//This function accepts an array of fields as a parameter.  The returned value is valid CAML for use with Web Service calls.
//console.log( roboCAML.ViewFields(["Title", "Description", "ProjectName", "RelatedID"]) );

//roboCAML.BatchCMD for Deleting Items
//This function will create the text needed to Add/Update/Delete
/*
console.log( roboCAML.BatchCMD({
		batchCMD: "Delete",			//Mandatory parameter
		IDs: [1,2,3]							//Mandatory parameter
	})
);


//roboCAML.BatchCMD for creating New Items

console.log( roboCAML.BatchCMD({
		batchCMD: "New",				//Mandatory parameter
		//Mandatory parameter
		valuePairs: [["JSPersonnelNameLookup", 1, "ModuleNotes", "ModuleNotes", "Description", "Googly Glop"], ["ListUID", 3]]  //Static Column Name, Value
	})
);
*/

//roboCAML.BatchCMD for Update
//IDs and valuePairs must be in the same order or you'll kill KITTENS!!!!
//If you have ideas to improve this, let me know!
/*
console.log( roboCAML.BatchCMD({
		batchCMD: "Update",
		IDs: [1,2,3],
		valuePairs: [["Rank", "Numero Uno", "Description", "Some Notes", "Col3", "Update3"], ["Col1", "1"], ["Col1", 1, "Col2", 2]] //Static Column Name, Value
	})
);

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

console.log( roboCAML.BatchCMD({
		batchCMD: "Update",
		IDs: arrIDs, //For IDs, just add the array as is
		valuePairs: [arrValuePairs] //For valuePairs, wrap your prebuilt array in an array
		//Static Column Name, Value
	})
);
*/

//roboCAML.Query ~ Your very own U2U in JavaScript *** YAY!!! ***
/*
console.log( roboCAML.wrapNode("Query", roboCAML.wrapNode("Where", roboCAML.Query({
		//webURL: "http://YourURL",  												//optional
		listName: "Bid Key",															//Mandatory
		config: [																				//Mandatory
			{
				filter: "Or",																	//Conditionally Mandatory; see below
				//Valid ops: Eq, Neq, Gt, Geq, Lt, Leq, IsNull, IsNotNull, BeginsWith, Contains, DateRangesOverlap, Includes ~ ops are case sensitive!
				op: "IsNotNull",																	//Mandatory
				staticName: "JSBidHireModuleNotes",						//Mandatory
				value: "Some Comments"											//Conditionally Mandatory, IsNull and IsNotNull do not require a value.
			},
			{
				filter: "Or",
				op: "Eq",
				staticName: "ID",
				value: 14,
				LookupId: true															//LookupId is an optional parameter
			},
			{
				filter: "And",
				op: "Geq",
				staticName: "Title",
				value: "Title Text"
			},
			{
			//Notice, the last query does not need filter.  The code will ignore it even if you try to configure it here
				op: "Eq",
				staticName: "owshiddenversion",
				value: 100
			}
		]
	}) ) + roboCAML.OrderBy(["Title", "True"]) )
);
*/
//For dynamic calls, build up an array for config.  This syntax is valid:

//var array = [];
//array.push({ filter: "Or", op: "Neq", staticName: "JSBidHireModuleNotes", value: "Some Comments" }, {filter: "Or", op: "Eq", staticName: "ID", value: 14, LookupId: true});
/*
console.log( roboCAML.Query({
		//webURL: "http://YourURL",
		listName: "Bid Key",
		config: array
	})
);
*/


//roboCAML.OrderBy ~ Use after closing the <Where> tag, but before closing the <Query> tag.
//You must provide True or False for Ascending
//console.log( roboCAML.OrderBy(["Title", "True", "Description", "False", "ProjectName", "False", "RelatedID", "True"]) );