# SPECIFICATION.md — Engineering & TDD Verification Contracts

> Проект: **GaitAI**  
> Стандарт: **PStack TDD Protocol & Clean Architecture**

---

## 1. Контракты ядра данных и биомеханики (`src/core/`)

### 1.1. `data_loader.py`
* **Функция:** `load_discrete_dataset(path: Path) -> pd.DataFrame`
  * Контракт: Автоматически парсит разделитель `;` и десятичную запятую `,`.
  * Валидация: Заменяет строки `NaN` на `np.nan`.
  * Типизация: `weight`, `height`, `LegLength`, `GPS_a`, `GVS_*` строго `float64`. `subject` и `side` — строки.
* **Функция:** `load_kinematics_dataset(path: Path) -> pd.DataFrame`
  * Контракт: Загружает 1001-точечные кривые кинематики.
  * Интерполяция: Пропуски внутри временного ряда заполняются сплайн/линейной интерполяцией `interpolate(method='linear')`.
* **Тест (`tests/test_data_loader.py`):**
  * `test_parse_european_csv_format`: проверка корректности чтения чисел `46,5` $\rightarrow$ `46.5`.
  * `test_no_unhandled_nans`: проверка отсутствия `NaN` в интерполированных кинематических кривых.

### 1.2. `biomechanics.py`
* **Функция:** `compute_true_joint_extension(delta_hip: float, delta_pelvis: float) -> float`
  * Контракт: $TJE = \Delta \text{hip} - \Delta \text{pelvis}$.
* **Функция:** `compute_pcr(delta_gvs_pelvis: float, delta_gvs_knee: float, delta_gvs_ankle: float, delta_hip_ext: float) -> float`
  * Контракт: Вычисляет $PCR$ с весами $(0.5, 0.3, 0.2)$. При $|\Delta \text{hip_ext}| < 0.001$ возвращает $0.0$ во избежание деления на ноль.
* **Функция:** `classify_icf_b770(gps: float) -> str`
  * Контракт: Возвращает код `b770.0` .. `b770.4` согласно пороговым интервалам ВОЗ.
* **Функция:** `classify_icf_d450(anomaly_pct: float, cv_stride: float) -> str`
  * Контракт: Возвращает код `d450.0` .. `d450.4` по стабильности шагов.
* **Тест (`tests/test_biomechanics.py`):**
  * `test_pcr_calculation`: $PCR$ для контрольного пациента из Leuven должен соответствовать ожидаемому значению $> 0.8$.
  * `test_icf_b770_boundaries`: проверка граничных значений GPS ($5.5^\circ, 7.5^\circ, 11.0^\circ, 15.0^\circ$).

---

## 2. Контракты машинного обучения (`src/ml/`)

### 2.1. `vr_predictor.py`
* **Класс:** `VRResponderClassifier`
  * Схема валидации: `LeaveOneGroupOut` (LOSO) по `subject`.
  * Инвариант: Категорический запрет утечки данных — скейлер и импьютер обучаются **строго** на тренировочных фолдах.
  * Метод: `train_evaluate_loso(X, y, groups) -> Dict[str, float]`
  * Возвращаемые метрики: `balanced_accuracy`, `roc_auc`, `sensitivity`, `specificity`.
* **Тест (`tests/test_ml_leakage.py`):**
  * `test_zero_data_leakage`: доказать, что ни один цикл тестового пациента не попал в обучающую выборку фолда.
  * `test_metrics_are_realistic`: Balanced Accuracy не должна быть фиктивными 99% (ожидаемый диапазон 65%–85%).

### 2.2. `anomaly_detector.py`
* **Класс:** `KinematicPCAAnomalyDetector`
  * Метод: `fit(stable_curves: np.ndarray)` — обучение PCA на 1001-мерных кривых стабильных шагов Baseline.
  * Метод: `detect(test_curves: np.ndarray) -> np.ndarray[bool]` — возврат маски сбойных шагов на основе $Q$-статистики ошибки реконструкции.
* **Тест (`tests/test_anomaly_detector.py`):**
  * `test_anomaly_detection_reproducibility`: проверка воспроизводимости детекции нестабильных шагов.

---

## 3. Контракты REST API бэкенда (`src/api/`)

* `GET /health` $\rightarrow$ `{"status": "ok", "db": "connected", "patients_count": 29}`
* `GET /api/v1/patients` $\rightarrow$ Список 29 пациентов с антропометрией и стороной исследования.
* `GET /api/v1/patients/{id}/analysis` $\rightarrow$ Сравнение Baseline vs Verbal vs VR (углы, GVS, GPS, $TJE$, $PCR$, МКФ).
* `GET /api/v1/patients/{id}/kinematics` $\rightarrow$ Векторизованные 1001-точечные кривые (0–100% шага) с доверительным коридором TD-нормы.
* `POST /api/v1/upload` $\rightarrow$ Загрузка пользовательского CSV файла с авто-валидацией и сохранением в БД.
* `GET /api/v1/statistics/regional` $\rightarrow$ Макро-статистика здравоохранения области Абай и РК.
* `POST /api/v1/patients/{id}/report` $\rightarrow$ Авто-генерация официального клинического протокола (KZ/RU).
