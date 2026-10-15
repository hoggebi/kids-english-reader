# 음성 출처와 설정

모든 파일은 계정/API 키 없이 이 컴퓨터에서 공개 모델을 실행해 만들었습니다. 배포되는 파일은 MP3이며 모델 실행환경이나 가중치는 ZIP에 포함하지 않습니다.

| 역할 | 생성 방식 | 기준 음성 |
|---|---|---|
| 해설 | Kokoro-82M / af_heart, 미국 영어, speed=0.85 | 첫 해설 샘플 |
| 여자아이 | Qwen3-TTS Base | 자연스럽게 느리게 재생성해 사용자가 수락한 여자아이 샘플 |
| 남자아이 | Qwen3-TTS Base | 두 소년 후보 중 사용자가 선택한 1번 |
| 성인 남성 | Qwen3-TTS Base | 남자아이와 비교해 사용자가 수락한 성인 남성 샘플 |

대사 목소리는 Qwen3-TTS VoiceDesign으로 만든 가상 배역 샘플에서 추출한 음색 정보를 Qwen3-TTS Base에 적용합니다. 실제 아동이나 특정인의 음성 복제가 아니며, Microsoft Ana/Maisie 샘플은 사용하지 않았습니다. 샘플이 짧으므로 문장 길이·문맥에 따라 억양과 발화 속도에는 차이가 있을 수 있습니다. 파일을 0.7배로 늘이는 후처리는 적용하지 않았습니다. 음량은 안전한 범위에서 정리했습니다.

## 공개 모델과 라이선스
- Qwen3-TTS VoiceDesign: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign
- Qwen3-TTS Base: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base
- Qwen 코드: https://github.com/QwenLM/Qwen3-TTS
- 위 Qwen 모델과 코드는 Apache-2.0으로 공개되며 상업적 사용을 허용합니다. 라이선스 사본 동봉.
- Kokoro-82M: https://huggingface.co/hexgrad/Kokoro-82M (Apache-2.0)
- kokoro-onnx: https://github.com/thewh1teagle/kokoro-onnx (MIT)

패키지 생성은 원문 교재의 저작권 허락을 대신하지 않습니다. 원문 문장·ID·배역 설정은 사용자 제공 manifest를 따릅니다. 예를 들어 Lesson 3 대화 B는 원본대로 child_boy입니다.

## 검증의 범위
파일 개수·ID·MP3 디코딩·mono/샘플레이트·길이를 확인하고, 별도 음성 인식으로 원문과 비교합니다. 음성 인식 결과 자체에 오류가 있을 수 있으며, 전 문장에 대한 사람의 청취 검수나 실제 앱·기기 배포 검증을 의미하지 않습니다. `PREVIEW.html`에서 레슨별로 확인할 수 있습니다.

짧은 해설 `L5_body_04`는 원문 식별을 개선하기 위해 같은 해설 목소리의 speed=0.9로 다시 생성했습니다. 다른 해설은 기본 speed=0.85입니다. 이 설정은 모델의 자연 발화 속도이며 파일을 늘이는 후처리가 아닙니다.
