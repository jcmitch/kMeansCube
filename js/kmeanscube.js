$(document).ready(function() {
    var ADJ_MAX = 1;
    var ADJ_MIN = -1;
    var FPS = 40;
    var MIN_DATA_POINTS = 2;

    var vertices = [
        new Point3D(-1, 1, -1),
        new Point3D(1, 1, -1),
        new Point3D(1, -1, -1),
        new Point3D(-1, -1, -1),
        new Point3D(-1, 1, 1),
        new Point3D(1, 1, 1),
        new Point3D(1, -1, 1),
        new Point3D(-1, -1, 1)
    ];

    var faces = [[0, 1, 2, 3], [1, 5, 6, 2], [5, 4, 7, 6], [4, 0, 3, 7], [0, 4, 5, 1], [3, 2, 6, 7]];

    var angle = 0;

    var canvas;
    var ctx;
    var height = 400;
    var width = 400;
    var data = [];
    var means = [];
    var assignments = [];
    var meansCount = 1;
    var dataExtremes;
    var dataRange;
    var drawDelay = 2000;
    var curHoverRow;

    var aniTimer;
    var calcTimer;
    var raf;

    function Point3D(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;

        this.rotateX = function(angle) {
            var rad, cosa, sina, y, z;
            rad = angle * Math.PI / 180;
            cosa = Math.cos(rad);
            sina = Math.sin(rad);
            y = this.y * cosa - this.z * sina;
            z = this.y * sina + this.z * cosa;
            return new Point3D(this.x, y, z);
        }

        this.rotateY = function(angle) {
            var rad, cosa, sina, x, z;
            rad = angle * Math.PI / 180;
            cosa = Math.cos(rad);
            sina = Math.sin(rad);
            z = this.z * cosa - this.x * sina;
            x = this.z * sina + this.x * cosa;
            return new Point3D(x, this.y, z);
        }

        this.rotateZ = function(angle) {
            var rad, cosa, sina, x, y;
            rad = angle * Math.PI / 180;
            cosa = Math.cos(rad);
            sina = Math.sin(rad);
            x = this.x * cosa - this.y * sina;
            y = this.x * sina + this.y * cosa;
            return new Point3D(x, y, this.z);
        }

        this.project = function(viewWidth, viewHeight, fov, viewDistance) {
            var factor, x, y;
            factor = fov / (viewDistance + this.z);
            x = this.x * factor + viewWidth / 2;
            y = this.y * factor + viewHeight / 2;
            return new Point3D(x, y, this.z);
        }
    }

    function setup() {
        draw();
        means = [];
        assignments = [];
        canvas = $('.myCanvas');
        if(canvas.get(0) && canvas.get(0).getContext) {
            ctx = canvas.get(0).getContext('2d');
        }

        var len = data.length;
        var message = len >= MIN_DATA_POINTS ? 'Calculating...' : 'Waiting for '+(MIN_DATA_POINTS-len)+' data points...';
        $('.message').text(message);

        if (!data.length || data.length < MIN_DATA_POINTS) {return;}
        dataExtremes = getDataExtremes(data);
        dataRange = getDataRanges(dataExtremes);
        means = initMeans(meansCount);
        makeAssignments();
        setTimeout(run, drawDelay);
    }

    function getDataRanges(extremes) {
        var ranges = [];
        for(var dimension in extremes) {
            ranges[dimension] = extremes[dimension].max - extremes[dimension].min;
        }
        return ranges;
    }

    function getDataExtremes(points) {
        var extremes = [];
        for(var i in data) {
            var point = data[i];
            for(var dimension in point) {
                if(!extremes[dimension]) {
                    extremes[dimension] = {
                        min: 1000,
                        max: 0
                    };
                }
                if(point[dimension] < extremes[dimension].min) {
                    extremes[dimension].min = point[dimension];
                }
                if(point[dimension] > extremes[dimension].max) {
                    extremes[dimension].max = point[dimension];
                }
            }
        }
        return extremes;
    }

    function initMeans(k) {
        k = k || 1;
        while(k--) {
            var mean = [];
            for(var dimension in dataExtremes) {
                mean[dimension] = dataExtremes[dimension].min + (Math.random() * dataRange[dimension]);
            }
            means.push(mean);
        }
        return means;
    };

    function makeAssignments() {
        for(var i in data) {
            var point = data[i];
            var distances = [];
            for(var j in means) {
                var mean = means[j];
                var sum = 0;
                for(var dimension in point) {
                    var difference = point[dimension] - mean[dimension];
                    difference *= difference;
                    sum += difference;
                }
                distances[j] = Math.sqrt(sum);
            }
            assignments[i] = distances.indexOf(Math.min.apply(Math, distances));
        }
        updateTableMeans();
    }

    function moveMeans() {
        makeAssignments();
        var sums = Array(means.length);
        var counts = Array(means.length);
        var moved = false;
        for(var j in means) {
            var mean = means[j];
            counts[j] = 0;
            sums[j] = Array(mean.length);
            for(var dimension in mean) {
                sums[j][dimension] = 0;
            }
        }
        for(var point_index in assignments) {
            var mean_index = assignments[point_index];
            var point = data[point_index];
            var mean = means[mean_index];
            counts[mean_index]++;
            for(var dimension in mean) {
                sums[mean_index][dimension] += point[dimension];
            }
        }
        for(var mean_index in sums) {
            if(counts[mean_index] === 0) {//Mean w/out nodes
                sums[mean_index] = means[mean_index];
                for(var dimension in dataExtremes) {
                    sums[mean_index][dimension] = dataExtremes[dimension].min + (Math.random() * dataRange[dimension]);
                }
                continue;
            }
            for(var dimension in sums[mean_index]) {
                sums[mean_index][dimension] /= counts[mean_index];
            }
        }
        if(means.toString() !== sums.toString()) {
            moved = true;
        }
        means = sums;
        return moved;
    }

    function createPoints() {
        var meansProj = [];
        var dataProj = [];
        var createPoint = function(point, color) {
            ctx.save();
            ctx.fillStyle = color;
            ctx.strokeStyle = "#000";
            ctx.beginPath();
            ctx.arc(point.x, point.y, 7, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        };
        for(var i in data) {
            var point = data[i];
            var x = ((ADJ_MAX - ADJ_MIN) * (point[0] - dataExtremes[0].min)) / (dataExtremes[0].max - dataExtremes[0].min) + ADJ_MIN;
            var y = ((ADJ_MAX - ADJ_MIN) * (point[1] - dataExtremes[1].min)) / (dataExtremes[1].max - dataExtremes[1].min) + ADJ_MIN;
            var z = ((ADJ_MAX - ADJ_MIN) * (point[2] - dataExtremes[2].min)) / (dataExtremes[2].max - dataExtremes[2].min) + ADJ_MIN;
            var colPt = new Point3D(x, y, z);
            var colRt = colPt.rotateX(angle).rotateY(angle);
            var colProj = colRt.project(500, 500, 500, 4);
            dataProj.push(colProj);
        }

        for(var i in means) {
            var point = means[i];
            var x = ((ADJ_MAX - ADJ_MIN) * (point[0] - dataExtremes[0].min)) / (dataExtremes[0].max - dataExtremes[0].min) + ADJ_MIN;
            var y = ((ADJ_MAX - ADJ_MIN) * (point[1] - dataExtremes[1].min)) / (dataExtremes[1].max - dataExtremes[1].min) + ADJ_MIN;
            var z = ((ADJ_MAX - ADJ_MIN) * (point[2] - dataExtremes[2].min)) / (dataExtremes[2].max - dataExtremes[2].min) + ADJ_MIN;
            var colPt = new Point3D(x, y, z);
            var colRt = colPt.rotateX(angle).rotateY(angle);
            var colProj = colRt.project(500, 500, 500, 4);
            meansProj.push(colProj);
        }

        dataProj.forEach(function(proj, idx) {
            var tmpMeanProj = meansProj[assignments[idx]];
            ctx.save();
            ctx.strokeStyle = "#908F8F";
            ctx.beginPath();
            ctx.moveTo(proj.x, proj.y);
            ctx.lineTo(tmpMeanProj.x, tmpMeanProj.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            var clr = (curHoverRow === idx) ? 'rgba(0,255,0,1)' : 'rgba(255,0,0,1)';
            createPoint(proj, clr);
        });
        meansProj.forEach(function(mean) {
            createPoint(mean, 'rgba(0,0,255,.5)');
        });
    }

    function run() {
        var moved = moveMeans();
        if(moved) {
            calcTimer = setTimeout(run, drawDelay);
        } else {
            $('.message').text('Completed.');
        }
    }

    function draw() {
        aniTimer = setTimeout(function() {
            raf = requestAnimationFrame(draw);
            var t = new Array();

            ctx.fillStyle = "rgb(255,255,255)";
            ctx.fillRect(0, 0, 500, 500);

            vertices.forEach(function(vert, i) {
                var v = vertices[i];
                var r = v.rotateX(angle).rotateY(angle);
                var p = r.project(500, 500, 500, 4);
                t.push(p)
            });
            var avg_z = new Array();

            faces.forEach(function(face, i) {
                var f = faces[i];
                avg_z[i] = {
                    "index" : i,
                    "z" : (t[f[0]].z + t[f[1]].z + t[f[2]].z + t[f[3]].z) / 4.0
                };
            });

            avg_z.sort(function(a, b) {
                return b.z - a.z;
            });

            faces.forEach(function(face, i) {
                var f = faces[avg_z[i].index];
                ctx.fillStyle = 'rgba(0,0,0,0.025)';
                ctx.strokeStyle = "#908F8F";
                ctx.beginPath();
                ctx.moveTo(t[f[0]].x, t[f[0]].y);
                ctx.lineTo(t[f[1]].x, t[f[1]].y);
                ctx.lineTo(t[f[2]].x, t[f[2]].y);
                ctx.lineTo(t[f[3]].x, t[f[3]].y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            });
            if (data.length && data.length >= MIN_DATA_POINTS) {
                createPoints();
            }
            angle += 2;
        }, 1000 / FPS);
    }

    setup();

    function updateTableMeans() {
        $('.clusterLbl').each(function(idx, row) {
            if (idx > 0) {
                $(row).text(assignments[idx-1]);
            }
        });
    }

    function restart() {
        clearTimeout(aniTimer);
        if (calcTimer) {
            clearTimeout(calcTimer);
        }
        if (raf) {
            window.cancelAnimationFrame(raf);
        }
        setup();
    }

    function addData(name, newData) {
        var checkedData = [];
        newData.forEach(function(tmpData, idx) {
            var isPct = false;
            tmpData = tmpData.replace('"','');
            if (tmpData.match('%')) {
                tmpData = tmpData.replace('%','');
                isPct = true;
            }
            if (tmpData.match(/[^\d.]/)) {
                tmpData = 0;
            }
            checkedData.push({data: tmpData, isPct: isPct});
        });
        var a = parseFloat(checkedData[0].data);
        var b = parseFloat(checkedData[1].data);
        var c = parseFloat(checkedData[2].data);
        data.push([a,b,c]);
        name = name.replace('"', '');
        name = name || '*empty*';

        $('.dataTable tr:last').after('<tr>'+
                    '<td class="clusterLbl">2</td>'+
                    '<td>'+name+'</td>'+
                    '<td>'+a+(checkedData[0].isPct ? '%' : '')+'</td>'+
                    '<td>'+b+(checkedData[1].isPct ? '%' : '')+'</td>'+
                    '<td>'+c+(checkedData[2].isPct ? '%' : '')+'</td>'+
                    '<td class="btnWrapper"><button>Delete</button></td>'+
                '</tr>');
    }

    $('.updateK').on('click', function() {
        var newK = $('.numOfK').val() || '0';
        if (newK.match(/[^\d]/)) {
            newK = 0;
            $('.numOfK').val(newK);
        }
        $('.numOfK').val('');
        meansCount = parseInt(newK);
        restart();
    });

    $('.addData').on('click', function() {
        var dataSet = [];
        var checkedData = [];
        dataSet.push($('.dataA').val() || '0');
        dataSet.push($('.dataB').val() || '0');
        dataSet.push($('.dataC').val() || '0');
        var name = $('.dataName').val() || '*empty*';
        addData(name, dataSet);

        $('.dataName').val('');
        $('.dataA').val('');
        $('.dataB').val('');
        $('.dataC').val('');
        restart();
    });

    $('.dataTable').on('click', '.btnWrapper', function(evt) {
        var rowIndex = $(this).parent().parent().children().index($(this).parent()) - 1;
        $(this).closest('tr').remove();
        data.splice(rowIndex, 1);
        restart();
    });

    $('.dataTable').on('mouseover', 'tr', function(evt) {
        curHoverRow = $('.dataTable').find('tr').index($(this)) - 1;
    });

    $('.dataTable').on('mouseout', 'tr', function(evt) {
        curHoverRow = null;
    });

    $('#files').on('change', function(evt) {
        var f = evt.target.files[0];
        var reader = new FileReader();

      reader.onload = (function(theFile) {
        return function(e) {
            if (e && e.target && e.target.result) {
                var rows = JSON.stringify(e.target.result).split(/\\r/);
                rows.forEach(function(row) {
                    var fields = row.split(',');
                    addData(fields[0], fields.slice(1));
                });
                restart();
            }
        };
      })(f);

      reader.readAsText(f);
    });
});
