var FolderName = "Udemy Download/";
var Downloads = [];
var load = {};
var course = {};
var video = {};
var currentPage = 1;
var pageSize = 10;

var Errors = 0;
var LoadedData ={};

video.base = new Array();
$(document).ready(function(){
	$('.version').text('v' + chrome.runtime.getManifest().version);
	$('Title').text(chrome.runtime.getManifest().name + ' v' + chrome.runtime.getManifest().version);
});
const waitFor = (ms) => new Promise((r) => setTimeout(r, ms));
const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};
// proto replace turkish char
chrome.downloads.setShelfEnabled(false);
var Application = {
  init :  function() {
    Application.Cookies = [];
	Application.Cookies = {ud_cache_user : ""};
    chrome.cookies.getAll({
        domain: "www.udemy.com"
      }, function (cookies) {

        for (var i = 0; i < cookies.length; i++) {
          Application.Cookies[cookies[i].name] = cookies[i].value;
        }
        if(Application.Cookies["ud_cache_user"].length > 2 ) { //login ise
            $('.sonar-wrapper').hide();
            $('.btn-container').show();
            $('#analyze').on("click", function() {
                $('.btn-container').hide();
                $(this).prop('disabled',true);
                $(this).text("Analyzing..");
                $('.sonar-wrapper').show();
                $('#total-text').text("Please wait analyzing..");
                setTimeout(() => {
                    Application.Course();
                }, 1000);
            });
        }else{ // değilse
            $('body').empty();
            $('body').html("<i>Please log in on Udemy and restart the extension.</i>");
            chrome.tabs.create({url : "https://www.udemy.com/join/login-popup/"}, () => {}) 
        }    
    });

  },
  Course : function() {
      load.url = "https://www.udemy.com/api-2.0/users/me/subscribed-courses/";
      load.type = "GET";
      load.data = {
          "page_size": 100,
          "ordering": "-last_accessed",
          "fields[course]": "@min,visible_instructors,image_125_H,favorite_time,archive_time,completion_ratio,last_accessed_time,enrollment_time,is_practice_test_course,features,num_collections,published_title,is_private,buyable_object_type",
          "fields[user]": "@min,job_title",
          "page" : 1
      };

      course.type = "CourseList";
      var isLoaded = this.getFromLocalStorage("LoadedAllCourses");
      
      if(isLoaded == null || isLoaded == false) {
        LoadedData = this.uGetApi(load);
        total_pages = parseInt(Math.ceil(LoadedData.count/100));

        if(LoadedData.count > 100) {
          for(i = 0; i < total_pages-1; i++ )
          {
            load.data.page += 1;
            $.merge(LoadedData.results,this.uGetApi(load).results);
          }
          
        }else{
          course.CourseList = this.uGetApi(load); // get course list
        }

        this.saveToLocalStorage("LoadedAllCourses", 1);
        CourseCount = this.saveToLocalStorage("LoadedData", LoadedData);
      }else{
        LoadedData = this.getFromLocalStorage("LoadedData");
      }

      Application.sendExtension(course.type, LoadedData);
  },
  Counter : async function(obj) {
      $('#current-text').show();
      $('#total-text').show();
      $('#current-text').text(obj.Current);
      if(obj.Total) {
          $('#total-text').text(" in " + obj.Total + "| Errors: " + Errors);
      }
  },
  PlayList : async function () {

      video.base = new Array();
      load.url = "https://www.udemy.com/api-2.0/courses/"+Application.CourseId+"/subscriber-curriculum-items";
      load.type = "GET";
      load.data = {
          "page_size": "1400",
          "fields[lecture]": "title,object_index,is_published,sort_order,created,asset,supplementary_assets,is_free",
          "fields[quiz]": "title,object_index,is_published,sort_order,type",
          "fields[practice]": "title,object_index,is_published,sort_order",
          "fields[chapter]": "title,object_index,is_published,sort_order",
          "fields[asset]": "title,filename,asset_type,status,time_estimation,is_external",
          "caching_intent": "True"
      };
      var getVideoList = {}

      // check if videolist is loaded
      var loadedVideoList = this.getFromLocalStorage("LoadedVideoList");
      if(loadedVideoList==null) {
        getVideoList = this.uGetApi(load);
        loadedVideoList = [];
        // means api call valid
        if(getVideoList){
          //console.log(getVideoList);
          loadedVideoList.push({
            courseID : Application.CourseId,
            videoList : getVideoList
          });
          this.saveToLocalStorage("LoadedVideoList", loadedVideoList);
        }
      }else{
        const courseDataExists = loadedVideoList.filter(course => Application.CourseId === course.courseID);
        if(courseDataExists.length > 0){
          fetchedRes = loadedVideoList.filter(function(loadedVideoList){
            if(loadedVideoList.courseID===Application.CourseId){
              return loadedVideoList.videoList;
            }
          });

          //console.log(fetchedRes[0].videoList);
          getVideoList = fetchedRes[0].videoList;
        }else{
          getVideoList = this.uGetApi(load);
          loadedVideoList.push({
            courseID : Application.CourseId,
            videoList : getVideoList
          });
          this.saveToLocalStorage("LoadedVideoList", loadedVideoList);
        }
      }

      video.type = "PlayList";
      
      VideoIdList = $.grep(getVideoList.results, function(element, index) {
          return (typeof element.asset  !== 'undefined') ? (element.asset.asset_type === 'Video') : "";
      });

      var i = 1;
      Errors = 0;
      Application.Counter({"Total" : VideoIdList.length});
      await asyncForEach(VideoIdList, async (v, k) => {
        try {
          await waitFor(0);
      
          var temp = {};
          temp.url = "https://www.udemy.com/api-2.0/users/me/subscribed-courses/" + Application.CourseId + "/lectures/" + v.id;
          temp.type = "GET";
          temp.data = {
            "fields[lecture]": "asset,description,download_url,is_free,last_watched_second",
            "fields[asset]": "asset_type,length,stream_urls,captions,thumbnail_sprite,slides,slide_urls,download_urls,image_125_H"
          };
      
          var VideoDetails = Application.uGetApi(temp, { "Current": i });
      
          
          // Validate video data
          if (!VideoDetails || !VideoDetails.asset || !VideoDetails.asset.stream_urls || !VideoDetails.asset.stream_urls.Video || !VideoDetails.asset.stream_urls.Video[0]) {
            console.warn(`Skipping video at index ${k} (ID: ${v.id}) - Invalid or missing video data.`);
            console.log(VideoDetails)
            
            tobepush = {
              "id": v.id,
              "VideoUrl": "",
              "VideoTitle": v.object_index + ". " + v.title + " <div class='btn-danger'>ERROR</div>",
              "VideoThumbnail": (VideoDetails.asset.thumbnail_sprite ? VideoDetails.asset.thumbnail_sprite.img_url : ""),
              "VideoQuality": "Auto"
            }

            Errors +=1;
            //return; // Skip this iteration
          }else{
            tobepush = {
              "id": v.id,
              "VideoUrl": VideoDetails.asset.stream_urls.Video[0].file,
              "VideoTitle": v.object_index + ". " + v.title,
              "VideoThumbnail": (VideoDetails.asset.thumbnail_sprite ? VideoDetails.asset.thumbnail_sprite.img_url : ""),
              "VideoQuality": VideoDetails.asset.stream_urls.Video[0].label
            }
          }
          video.base.push(tobepush);
      
          i++;
        } catch (error) {
          console.error(`Error processing video at index ${k} (ID: ${v.id}):`, error);
        }
      });

      Application.sendExtension(video.type, video.base);
  },
  sendExtension : function(a, b) {
      Application.Core({ "Step" : a, "Data" : b });
  },
  uGetApi :  function(data, type = "")
  {
    const results = $.ajax({
      url: data.url,
      type: data.type,
      "headers": {
          "Content-Type": "application/json, text/plain, */*",
          "x-udemy-authorization": "Bearer " + Application.Cookies["access_token"],
          "x-udemy-cache-brand"  : Application.Cookies["ud_cache_brand"],
          "x-udemy-cache-campaign-code": Application.Cookies["ud_cache_campaign_code"],
          "x-udemy-cache-device" : Application.Cookies["ud_cache_device"],
          "x-udemy-cache-language": Application.Cookies["ud_cache_language"],
          "x-udemy-cache-logged-in" : Application.Cookies["ud_cache_logged_in"],
          "x-udemy-cache-marketplace-country" : Application.Cookies["ud_cache_marketplace_country"],
          "x-udemy-cache-modern-browser" : Application.Cookies["ud_cache_modern_browser"],
          "x-udemy-cache-price-country" : Application.Cookies["ud_cache_price_country"],
          "x-udemy-cache-release" : Application.Cookies["ud_cache_release"],
          "x-udemy-cache-user" : Application.Cookies["ud_cache_user"],
          "x-udemy-cache-version" : Application.Cookies["ud_cache_version"]
      },
      async: false,
      data:data.data,
      beforeSend: function() {
      },
      statusCode: {
          200 : function(e) {
              Application.Counter(type);
              return e;
          },
          404 : function(e)  {
              Application.Debug("Api Exception");
              return e;
          }
      }
    });

    //console.log("Loaded: ", results.responseJSON);

    return results.responseJSON
  },
  saveToLocalStorage : function (key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },
  getFromLocalStorage : function (key) {
    var data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },
  CreateTable: function (obj) {
    $("#example").empty();
    $("#example").append(
      '<table id="linkTable" class="table" cellspacing="0" width="100%"></table>'
    );

    var linkTable = $("#linkTable").DataTable({
      //dom: 'Blfrtip',
      dom: "Blftip",
      data: obj.data,
      rowId: "id",
      ordering: false,
      lengthChange: obj.lengthChange,
      lengthMenu: [5],
      scrollY: 500,
      scrollX: true,
      scrollCollapse: true,
      iDisplayLength: obj.DisplayLength,
      paging: obj.Paging,
      bFilter: true,
      columns: obj.columns,
      buttons: obj.buttons,
      columnDefs: obj.columnDefs,
      language: {
        info: "searched : _TOTAL_ | Errors: " + Errors,
        search: "_INPUT_",
        searchPlaceholder: "Search by name",
        infoFiltered: "in _MAX_",
      },
      initComplete: function () {
        $("#linkTable_length").attr(
          "style",
          "position:relative; display:inline; left:2%;"
        );
        $("#linkTable_length label").attr("style", "padding-top: 5px;");
        $("#linkTable_filter").attr(
          "style",
          "position:absolute; display:inline; right:1.4%;"
        );
        $(".dataTables_scrollBody").attr(
          "style",
          "position: relative; overflow: auto; width: 100%; max-height:472px; height:472px;"
        );
        $(".dataTables_length").addClass("bs-select");
        var rows = $("#linkTable").dataTable().$("tr", { filter: "applied" });
        var checkboxes = rows.find("td").find("input");
        // input onChange event.
        checkboxes.on("change", (i, e) => {
          var checkboxChecked = checkboxes.filter("input:checked").length; //checkbox checked count
          if (checkboxChecked > 0) {
            $("#SelectedVideos").prop("disabled", false);
            $("#SelectAll span").text("Select All");
            $("#SelectedVideos").text(
              "Download " +
                checkboxChecked +
                " " +
                (checkboxChecked === 1 ? "Video" : "Videos")
            );
          } else {
            $("#SelectedVideos").prop("disabled", true);
            $("#SelectedVideos").text("Download Selected Videos");
          }

          if ($(i.target).filter("input:checked").length == 0) {
            $(i.target)
              .parent(0)
              .parent(0)
              .parent(0)
              .removeClass("selected-td");
          } else {
            $(i.target).parent(0).parent(0).parent(0).addClass("selected-td");
          }
        });

        rows
          .find("td")
          .filter('[class*="td-4"]')
          .append(
            "<div class='progress' style='margin-top:3px; height:1.2rem;'><div class='progress-bar' role='progressbar' style='width: 0%; background-color:var(--secondary)!important' aria-valuenow='50' aria-valuemin='0' aria-valuemax='100'>0%</div></div>"
          );
        rows
          .find("td")
          .filter('[class*="td-4"]')
          .find('[class*="progress"]')
          .hide();
        /*
                eq index numarası
                var progress = rows.find('td').filter('[class*="td-4"]').find('[class*="progress"]')
                progress.eq(0).show();
                */
      },
    });
    $("#linkTable tbody").on("click", "button", function (e) {
      var data = $(this).parents("tr").attr("id");
      if (Application.Type == "Course") {
        $(".sonar-wrapper").show();
        $("#example").empty();
        $("#counter").show();
        Application.Counter({ Current: 0, Total: 0 });
        Application.CourseId = data;
        //setTimeout(()=>{
        Application.PlayList();
        Errors = 0;
        //},1000);
      } else if (Application.Type == "Download") {
        var VideoDetails = $.grep(Application.data, function (v) {
          return v.id == data;
        })[0];
        var CourseDetail = $.grep(
          Application.CourseData.Data.results,
          function (v) {
            return v.id == Application.CourseId;
          }
        )[0];
        var temp = {};
        temp = {
          trid: data,
          fileurl: VideoDetails.VideoUrl,
          foldername:
            FolderName +
            Application.replaceFileName(
              CourseDetail.visible_instructors[0].display_name
            ) +
            "/" +
            Application.replaceFileName(CourseDetail.title) +
            "/",
          filename:
            Application.replaceFileName(VideoDetails.VideoTitle) + ".mp4",
        };

        Downloads.push(temp);

        Application.downloadSequentially(Downloads, () => {
          var rows = $("#linkTable").dataTable().$("tr", { filter: "applied" });
          rows
            .find("td")
            .find('[class*="btn-download"]')
            .prop("disabled", false);
          var btnFinishes = $('[class*="btn-download"]:contains(Downloaded)');
          btnFinishes.text("Re-Download");
          btnFinishes.removeClass("btn-danger");
          btnFinishes.addClass("btn-success");

          btnFinishes = null;

          var rows = $("#linkTable").dataTable().$("tr", { filter: "applied" });
          var checkboxChecked = rows
            .find("td")
            .find("input")
            .filter("input:checked").length;
          if (checkboxChecked > 0) {
            $("#SelectedVideos").prop("disabled"), false;
          }
        });
      } else {
        alert("Malformed data please try again");
      }
    });
  },
  GetSprite: function (data, type, full, meta) {
    return (
      '<img src="img_trans.gif" width="1" height="1" style="width:120px; height:67.5px; border:1px solid var(--dark); border: 2px solid var(--dark); background: url(' +
      data +
      ') -120px 0;background-size:400%">'
    );
  },
  GetImg: function (data, type, full, meta) {
    return '<img src="' + data + '" style="border: 2px solid var(--dark);"/>';
  },
  downloadSequentially: function (urls, callback) {
    let index = 0;
    let currentId;
    var trid;
    var videoRowIndex;
    var currentPage;
    chrome.downloads.onChanged.addListener(onChanged);

    next();

    function next() {
      if (index >= urls.length) {
        chrome.downloads.onChanged.removeListener(onChanged);
        callback();
        return;
      }

      const fileurl = urls[index].fileurl;
      const foldername = urls[index].foldername;
      const filename = urls[index].filename;
      trid = urls[index].trid;
      $("#linkTable")
        .dataTable()
        .$("tr", { filter: "applied" })
        .each((k, v) => {
          if (v.id == trid) {
            videoRowIndex = k;
          }
        });
      currentPage = parseInt(
        $(".pagination").find('[class*="active"] a').attr("data-dt-idx")
      );
      currentPage -= 1;

      index++;
      if (fileurl) {
          console.log(foldername + filename);
        chrome.downloads.download(
          {
            url: fileurl,
            filename: foldername + filename,
            saveAs: false,
            conflictAction: "overwrite",
          },
          (id) => {
            currentId = id;
          }
        );

      }
    }

    function onChanged({ id, state }) {
      if (id === currentId && state && state.current !== "in_progress") {
        // download finish.
        var rows = $("#linkTable").dataTable().$("tr", { filter: "applied" });
        var downloadButton = rows
          .filter("[id*=" + pollProgress.progressBar + "]")
          .find("td")
          .eq(3)
          .find("button");
        var progressBar = rows
          .filter("[id*=" + pollProgress.progressBar + "]")
          .find("td")
          .eq(3)
          .find("div")
          .filter('[class="progress-bar"]');
        var inputChecked = rows
          .filter("[id*=" + pollProgress.progressBar + "]")
          .find("td")
          .eq(0)
          .find("input")
          .filter("input:checked");

        downloadButton.text("Downloaded");
        downloadButton.removeClass("btn-warning");
        downloadButton.addClass("btn-danger");
        progressBar.css("width", "100%");
        progressBar.css("background-color", "var(--warning)");
        progressBar.prop("disabled", true);
        rows
          .filter("[id*=" + pollProgress.progressBar + "]")
          .removeClass("blink");
        Downloads = [];

        if (inputChecked.length == 1) {
          inputChecked.prop("checked", false);
          inputChecked.parent(0).parent(0).parent(0).removeClass("selected-td");

          var rows = $("#linkTable").dataTable().$("tr", { filter: "applied" });
          var checkboxes = rows.find("td").find("input");
          var checkboxChecked = checkboxes.filter("input:checked").length;

          if (checkboxChecked > 0) {
            $("#SelectedVideos").prop("disabled", false);
            $("#SelectedVideos").text(
              "Download " +
                checkboxChecked +
                " " +
                (checkboxChecked === 1 ? "Video" : "Videos")
            );
          } else {
            $("#SelectedVideos").prop("disabled", true);
            $("#SelectedVideos").text("Download Selected Videos");
          }
        }
        next();
      } else if(id === currentId && id > 0){

        setTimeout(()=>{
          pollProgress(id);
        },250);        
        
        var rows = $("#linkTable").dataTable().$("tr", { filter: "applied" });
        rows.find("td").find('[class*="btn-download"]').prop("disabled", true);
        $("#SelectedVideos").prop("disabled", true);

        if (currentPage !== parseInt(videoRowIndex / 5)) {
          $("#linkTable")
            .dataTable()
            .fnPageChange(parseInt(videoRowIndex / 5));
        }
      }
    }

    function pollProgress(downId) {
      pollProgress.downId = (downId !== undefined) ? downId : pollProgress.downId;
      pollProgress.tid = -1;
      pollProgress.progressBar = trid;
      pollProgress.videoRowIndex = videoRowIndex;
      pollProgress.currentPage = currentPage;
      chrome.downloads.search(
        {
          id: pollProgress.downId,
        },
        function (items) {
          var options = {
            anyMissingTotalBytes: false,
            anyInProgress: false,
            anyRecentlyCompleted: false,
            anyPaused: false,
            anyDangerous: false,
            totalBytesReceived: 0,
            totalTotalBytes: 0,
          };
          items.forEach(function (item) {
            if (item.state == "in_progress") {
              options.anyInProgress = true;
              if (item.totalBytes) {
                options.totalTotalBytes += item.totalBytes;
                options.totalBytesReceived += item.bytesReceived;

                var dPercent = parseInt(
                  (options.totalBytesReceived / item.totalBytes) * 100
                );
                var rows = $("#linkTable")
                  .dataTable()
                  .$("tr", { filter: "applied" });
                var progressDiv = rows
                  .filter("[id*=" + pollProgress.progressBar + "]")
                  .find("td")
                  .eq(3)
                  .find("div")
                  .filter('[class="progress"]');
                var progressBar = rows
                  .filter("[id*=" + pollProgress.progressBar + "]")
                  .find("td")
                  .eq(3)
                  .find("div")
                  .filter('[class="progress-bar"]');
                var downloadButton = rows
                  .filter("[id*=" + pollProgress.progressBar + "]")
                  .find("td")
                  .eq(3)
                  .find("button");

                // progress tekrar başlar ise, açık ise sıfırla
                if (progressDiv.is(":visible")) {
                  progressDiv.hide();
                  progressBar.prop("disabled", false);
                  downloadButton.removeClass("btn-danger");
                  downloadButton.addClass("btn-warning");
                  progressBar.css("background-color", "var(--warning)");
                }

                // progress kapalıysa aç.
                if (progressDiv.is(":hidden")) {
                  progressDiv.show();
                  progressBar.show();
                  progressBar.css("background-color", "var(--secondary)");

                  downloadButton.prop("disabled", true);
                  downloadButton.text("Downloading");
                  downloadButton.removeClass("btn-success");
                  downloadButton.addClass("btn-warning");
                  progressBar.css("background-color", "var(--warning)");
                }

                // devamlı çalışacak kısım
                
                progressBar.css("width", dPercent + "%");
                progressBar.text(dPercent + "%");
                rows
                  .filter("[id*=" + pollProgress.progressBar + "]")
                  .addClass("blink");
              } else {
                options.anyMissingTotalBytes = true;
              }
              var dangerous =
                item.danger != "safe" && item.danger != "accepted";
              options.anyDangerous = options.anyDangerous || dangerous;
              options.anyPaused = options.anyPaused || item.paused;
            } else if (
              item.state == "complete" &&
              item.endTime &&
              !item.error
            ) {
              options.anyRecentlyCompleted = options.anyRecentlyCompleted;
            }
          });

          if (options.anyInProgress && pollProgress.tid < 0) {
            pollProgress.start();
          }
        }
      );
    }
    pollProgress.tid = -1;
    pollProgress.MS = 10;

    pollProgress.start = function () {
      if (pollProgress.tid < 0) {
        pollProgress.tid = setTimeout(pollProgress, pollProgress.MS);
      }
    };
  },
  Core: function (obj) {
    switch (obj.Step) {
      case "CourseList":
        $("#counter").hide();
        Application.CourseData = obj;
        Application.Type = "Course";
        Application.Paging = true;
        Application.DisplayLength = 5;
        Application.lengthChange = false;
        Application.data = obj.Data.results;

        Application.columns = [
          {
            data: "image_125_H",
            className: "td-1",
            render: Application.GetImg,
          },
          {
            data: "title",
            className: "td-3",
          },
          {
            data: null,
            className: "td-4",
          },
        ];
        Application.buttons = [
          {
            text: "Re-Analyze course list",
            className: "btn-sm btn-danger btn-width-100",
            action: function (e, dt, node, config) {
              $("#example").empty();
              $(".sonar-wrapper").show();
              $("#counter").show();
              $("#message").hide();
              localStorage.removeItem('LoadedAllCourses');
              localStorage.removeItem('LoadedData');
              Application.Course();

            },
          },
        ];
        Application.columnDefs = [
          {
            targets: -1,
            data: null,
            className: "minumum",
            defaultContent:
              '<button class="btn btn-secondary btn-sm btn-success" type="button" style="width:100%;"><span>Get Video List</span></button>',
          },
        ];
        $(".sonar-wrapper").hide();
        $(".btn-container").hide();
        Application.CreateTable(Application);
        break;
      case "PlayList":
        $("#counter").hide();
        Application.Type = "Download";
        Application.data = obj.Data;
        Application.Paging = true;
        Application.DisplayLength = 5;
        Application.lengthChange = true;
        Application.columns = [
          {
            data: null,
            className: "td-1",
          },
          {
            data: "VideoThumbnail",
            render: Application.GetSprite,
            className: "td-2",
          },
          {
            data: "VideoTitle",
            className: "td-3",
          },
          {
            data: null,
            className: "td-4",
          },
        ];
        Application.buttons = [
          {
            text: "&laquo;",
            className: "btn-sm btn-danger btn-width-5 btn-right",
            action: function (e, dt, node, config) {
              $(".sonar-wrapper").show();
              $("#example").empty();
              Application.Course();
            },
          },
          {
            text: "Select All",
            className: "btn-sm btn-danger btn-width-25 btn-right",
            attr: {
              id: "SelectAll",
            },
            action: function (e, dt, node, config) {
              var rows = $("#linkTable")
                .dataTable()
                .$("tr", { filter: "applied" });
              var checkboxes = rows.find("td").find("input"); //all checkboxes
              var checkboxChecked = checkboxes.filter("input:checked").length; //checkbox checked count
              if (checkboxes.length == checkboxChecked) {
                checkboxes.prop("checked", false);
                $("#SelectedVideos").prop("disabled", true);
                $("#SelectAll span").text("Select All");
                $("#SelectedVideos").text("Download Selected Videos");
              } else {
                checkboxes.prop("checked", true);
                $("#SelectAll span").text("DeSelect All");
                $("#SelectedVideos").prop("disabled", false);
                var checkboxChecked = checkboxes.filter("input:checked").length; //checkbox checked count
                $("#SelectedVideos").text(
                  "Download " +
                    checkboxChecked +
                    " " +
                    (checkboxChecked === 1 ? "Video" : "Videos")
                );
              }
            },
          },
          {
            text: "Re-Analyze Videos",
            className: "btn-sm btn-danger btn-width-35 btn-right",
            action: function (e, dt, node, config) {
              $("#example").empty();
              $(".sonar-wrapper").show();
              $("#counter").show();
              $("#message").hide();
              localStorage.removeItem('LoadedVideoList');
              Application.PlayList();
            },
          },
          {
            text: "Download Selected Videos",
            className: "btn-sm btn-success btn-width-35 btn-right",
            attr: {
              id: "SelectedVideos",
              disabled: "disabled",
            },
            action: function (e, dt, node, config) {
              $("#linkTable").dataTable().fnPageChange(0);
              Downloads = [];
              var rows = $("#linkTable")
                .dataTable()
                .$("tr", { filter: "applied" });
              rows
                .find("td")
                .find("input")
                .filter("input:checked")
                .each(function (i) {
                  if (this.checked == true) {
                    var data = $(this).parents("td").parents("tr").attr("id");
                    var VideoDetails = $.grep(Application.data, function (v) {
                      return v.id == data;
                    })[0];
                    var CourseDetail = $.grep(
                      Application.CourseData.Data.results,
                      function (v) {
                        return v.id == Application.CourseId;
                      }
                    )[0];

                    var temp = {
                      trid: data,
                      fileurl: VideoDetails.VideoUrl,
                      foldername:
                        FolderName +
                        Application.replaceFileName(
                          CourseDetail.visible_instructors[0].display_name
                        ) +
                        "/" +
                        Application.replaceFileName(CourseDetail.title) +
                        "/",
                      filename:
                        Application.replaceFileName(VideoDetails.VideoTitle) +
                        ".mp4",
                    };

                    Downloads.push(temp);
                  }
                });

              Application.downloadSequentially(Downloads, () => {
                // toplu download
                var rows = $("#linkTable")
                  .dataTable()
                  .$("tr", { filter: "applied" });
                rows
                  .find("td")
                  .find('[class*="btn-download"]')
                  .prop("disabled", false);
                var btnFinishes = rows
                  .find("td")
                  .find('[class*="btn-download"]:contains(Downloaded)');
                btnFinishes.text("Re-Download");
                btnFinishes.removeClass("btn-danger");
                btnFinishes.addClass("btn-success");

                btnFinishes = null;

                var rows = $("#linkTable")
                  .dataTable()
                  .$("tr", { filter: "applied" });
                var checkboxChecked = rows
                  .find("td")
                  .find("input")
                  .filter("input:checked").length;
                if (checkboxChecked > 0) {
                  $("#SelectedVideos").prop("disabled", false);
                }
              });
            },
          },
        ];
        Application.columnDefs = [
          {
            targets: 0,
            data: null,
            defaultContent:
              '<div style="position:absolute;height:67.5px;"><input type="checkbox" style="position:relative;top: 35%; width:20px; height:20px;"></div>',
          },
          {
            targets: -1,
            data: null,
            className: "minumum",
            defaultContent:
              '<button class="btn btn-secondary btn-sm btn-success pd-0 btn-download" type="button" style="width:100%;"><span>Download</span></button>',
          },
        ];
        $(".sonar-wrapper").hide();
        $(".btn-container").hide();
        Application.CreateTable(Application);
        break;
      default:
        Application.data = null;
        break;
    }
  },
  Debug: function (exception) {
    console.log(exception);
  },
  espaceRegExp: function (str) {
    return str.replace(/[.*+\-?^${}()|[\]\\]/g, "\\$&");
  },
  replaceAll: function (str, find, replace) {
    return str.replace(
      new RegExp(Application.espaceRegExp(find), "g"),
      replace
    );
  },
  replaceFileName: function (str) {
    var filename = str;
    var invalid = ["\\", "/", ":", "*", "?", '"', "<", ">", "|", "."];
    $.each(invalid, function (key, value) {
      filename = Application.replaceAll(filename, value, "");
    });
    return filename;
  },
};

setTimeout(() => {
  Application.init();
}, 100);
