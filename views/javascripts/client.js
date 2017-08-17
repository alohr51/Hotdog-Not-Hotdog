var app = new Vue({
	el: '#container',
	data: {
		showLoader: false,
		hotdogResult: ''
	},
	// define methods under the `methods` object
	methods: {
		submitImage: function (event) {
			this.hotdogResult = '';
			this.showLoader = true;
			var formData = new FormData();
			formData.append("maybe-hotdog-image", $('#maybeHotdog')[0].files[0]);
			$.ajax({
				url: 'hotdog',
				method: 'POST',
				data: formData,
				enctype: 'multipart/form-data',
				processData: false,
				contentType: false,
				success: this.ajaxSuccess,
				error: this.ajaxError
			});
		},
		submitURL: function (event) {
			this.hotdogResult = '';
			this.showLoader = true;
			var url = $("#maybeHotdogURL").val();
			$.ajax({
				url: 'hotdog?url=' + encodeURIComponent(url),
				method: 'GET',
				success: this.ajaxSuccess,
				error: this.ajaxError			
			});
		},
		clearURL: function(){
			$("#maybeHotdogURL").val("");
		},
		ajaxSuccess: function (data) {
			var resultString = "Not Hotdog!";
			var isError = data.images[0].error;

			// check for errors returned from watson
			if(isError){
				this.showLoader = false;
				this.hotdogResult = isError.description;
				return;
			}

			// we only have 1 classifier ("hotdog") so if the image is a match the classifiers array will have 1 result
			// a class of hotdog and its match. If there is no match, classifiers array is empty
			var isHotdog = data.images[0].classifiers.length > 0;

			if(isHotdog){
				var score = data.images[0].classifiers[0].classes[0].score;
				resultString = "Hotdog! Watson scored this hot dog at: " + (score * 100).toFixed(2) + "%";
			}
			this.showLoader = false;
			this.hotdogResult = resultString;
		},
		ajaxError: function (jqXHR, exception) {
			this.showLoader = false;
			this.hotdogResult = jqXHR.responseJSON.msg;
		},
		imagePreview: function (event) {
			// remove url and results if there were any
			$("#maybeHotdogURL").val("");
			this.hotdogResult = '';

			if (event.target.files && event.target.files[0]) {
				var reader = new FileReader();
				reader.onload = function (e) {
					$('#imgPreview').attr('src', e.target.result);
				}
		    		reader.readAsDataURL(event.target.files[0]);
			}
		},
		urlPreviewPaste: function (event) {
			// need timeout of 0 to get to next event loop
			// this is so the value property of the input field
			// is able to be filled out after paste event comes through
			setTimeout(() => {
				$('#imgPreview').attr('src', event.target.value);
			}, 0);
			$("#maybeHotdog").val(null);
		}
	}
})
